from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
import uvicorn
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import hashlib
import PyPDF2
import io
import re
from enum import Enum
import random
import string
import json
import base64
import secrets
import requests
import boto3

ROOT_DIR = Path(__file__).resolve().parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
# Prefer MONGO_URI (Atlas or other deployments); fallback to local Compass-style URI
mongo_uri = os.getenv("MONGO_URI") or "mongodb://127.0.0.1:27017/secuhire_db"
client = AsyncIOMotorClient(mongo_uri)
db = client.get_default_database()

# Create the main app without a prefix
app = FastAPI()

# Health check endpoint for Render / uptime monitoring
@app.get("/health")
async def health_check():
    return {"status": "ok"}

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()
# Load JWT secret from environment for security; fallback used only for development
JWT_SECRET = os.getenv("JWT_SECRET", "secuhire_secret_key_2025")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "devkey")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "secret")
LIVEKIT_WS_URL = os.getenv("LIVEKIT_WS_URL", "wss://your-domain.com:7880")
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "http://localhost:3000")
RECORDINGS_DIR = os.getenv("RECORDINGS_DIR", str((ROOT_DIR / "recordings").resolve()))
EGRESS_SERVICE_URL = os.getenv("EGRESS_SERVICE_URL", "http://localhost:3001")

# Storage configuration
VIDEO_STORAGE = os.getenv("VIDEO_STORAGE", "local").lower()
AWS_REGION = os.getenv("AWS_REGION")
AWS_S3_BUCKET = os.getenv("AWS_S3_BUCKET")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")

S3_CLIENT = None
if VIDEO_STORAGE == "s3":
    try:
        if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
            S3_CLIENT = boto3.client(
                "s3",
                region_name=AWS_REGION,
                aws_access_key_id=AWS_ACCESS_KEY_ID,
                aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            )
        else:
            # fall back to default credential chain
            S3_CLIENT = boto3.client("s3", region_name=AWS_REGION)
        logging.info(f"S3 client initialized for bucket: {AWS_S3_BUCKET} in region: {AWS_REGION}")
    except Exception as e:
        logging.error(f"Failed to initialize S3 client: {e}")

# Safe Exam Browser (SEB) enforcement
SEB_REQUIRED = os.getenv("SEB_REQUIRED", "false").lower() == "true"
SEB_CONFIG_KEY_HASH = os.getenv("SEB_CONFIG_KEY_HASH", "")

async def require_seb(request: Request):
    """Require Safe Exam Browser headers if SEB_REQUIRED is true.
    Validates minimal header X-SafeExamBrowser-ConfigKeyHash against SEB_CONFIG_KEY_HASH.
    In production you may also validate X-SafeExamBrowser-RequestHash per SEB spec.
    """
    if not SEB_REQUIRED:
        return True
    provided = request.headers.get("X-SafeExamBrowser-ConfigKeyHash") or request.headers.get("x-safeexambrowser-configkeyhash")
    if not provided:
        raise HTTPException(status_code=403, detail="SEB required: missing config key hash")
    expected = SEB_CONFIG_KEY_HASH.strip()
    if not expected:
        # Misconfiguration: if required but no expected set, deny for safety
        raise HTTPException(status_code=500, detail="SEB required but server not configured")
    if provided.strip() != expected:
        raise HTTPException(status_code=403, detail="SEB validation failed")
    return True

# CORS configuration
# Prefer CORS_ORIGINS, fallback to ALLOWED_ORIGINS (legacy), default to localhost:3000
_cors_env = os.getenv("CORS_ORIGINS") or os.getenv("ALLOWED_ORIGINS") or "http://localhost:3000"
_origins_list = [o.strip() for o in _cors_env.split(",") if o.strip()]

# Always include common local dev origins
for _extra in ["http://localhost:3000", "http://127.0.0.1:3000"]:
    if _extra not in _origins_list:
        _origins_list.append(_extra)

# Include FRONTEND_BASE_URL origin automatically if provided
_frontend_base = os.getenv("FRONTEND_BASE_URL")
if _frontend_base:
    _fb = _frontend_base.strip()
    if _fb and _fb not in _origins_list:
        _origins_list.append(_fb)

# If wildcard is used, disable credentials per CORS spec
_allow_credentials = True
if _cors_env.strip() == "*" or _origins_list == ["*"]:
    _origins_list = ["*"]
    _allow_credentials = False

# Include FRONTEND_BASE_URL origin automatically if provided
_frontend_base = os.getenv("FRONTEND_BASE_URL")
if _frontend_base:
    _fb = _frontend_base.strip()
    if _fb and _fb not in _origins_list:
        _origins_list.append(_fb)

# If wildcard is used, disable credentials per CORS spec
_allow_credentials = True
if _cors_env.strip() == "*" or _origins_list == ["*"]:
    _origins_list = ["*"]
    _allow_credentials = False

logging.info(f"CORS configured - origins: {_origins_list}, allow_credentials: {_allow_credentials}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins_list,
    allow_credentials=_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Interview Rounds Configuration ---
ROUND_COUNTS = {1: 25, 2: 15, 3: 10}
ROUND_DURATIONS_SEC = {1: 5 * 60, 2: 20 * 60, 3: 15 * 60}

def _generate_mcq(index: int, prefix: str) -> Dict[str, Any]:
    options = ["Option A", "Option B", "Option C", "Option D"]
    correct_idx = index % 4
    return {
        "id": f"q{index}",
        "text": f"{prefix} Q{index+1}: Sample question {index+1}",
        "options": options,
        "correctIndex": correct_idx,
        "max_duration_sec": 60,
    }

# Fixed MCQ set for Round 1 (Speed Test, 25 questions)
REAL_ROUND1_QUESTIONS: List[Dict[str, Any]] = [
    {
        "text": "12, 19, 26, 33, 40, ___",
        "options": ["44", "47", "48", "49"],
        "correctIndex": 1,
    },
    {
        "text": "3, 9, 27, 81, ___",
        "options": ["108", "162", "243", "324"],
        "correctIndex": 2,
    },
    {
        "text": "5, 8, 13, 20, 29, ___",
        "options": ["38", "40", "41", "42"],
        "correctIndex": 2,
    },
    {
        "text": "2, 5, 11, 23, 47, ___",
        "options": ["95", "94", "93", "92"],
        "correctIndex": 1,
    },
    {
        "text": "100, 92, 84, 76, ___",
        "options": ["70", "69", "68", "72"],
        "correctIndex": 2,
    },
    {
        "text": "All engineers are graduates. Some graduates are artists. Which statement is definitely true?",
        "options": [
            "All artists are engineers.",
            "Some engineers are artists.",
            "No engineer is an artist.",
            "Some graduates are not engineers.",
        ],
        "correctIndex": 3,
    },
    {
        "text": "Ravi is older than Karan. Karan is older than Meera. Which statement is true?",
        "options": [
            "Meera is the oldest.",
            "Karan is the youngest.",
            "Ravi is the oldest.",
            "Ravi is the youngest.",
        ],
        "correctIndex": 2,
    },
    {
        "text": "In a certain code, WORK = 23 and PLAY = 16 (sum of letter positions). What is TEAM?",
        "options": ["42", "43", "44", "45"],
        "correctIndex": 2,
    },
    {
        "text": "Four friends P, Q, R, S sit in a row facing north. Q is to the immediate right of P. R is to the right of Q. S is to the left of P. Who is at the extreme right?",
        "options": ["P", "Q", "R", "S"],
        "correctIndex": 2,
    },
    {
        "text": "If SOME = 4591 and MORE = 5912 in a code, how is ROSE written?",
        "options": ["2541", "2451", "2514", "5241"],
        "correctIndex": 0,
    },
    {
        "text": "Find the odd one out:",
        "options": ["16", "25", "36", "45"],
        "correctIndex": 3,
    },
    {
        "text": "Find the odd pair:",
        "options": ["3 - 27", "4 - 64", "5 - 125", "6 - 48"],
        "correctIndex": 3,
    },
    {
        "text": "Find the odd one out:",
        "options": ["MONDAY", "FRIDAY", "SUNDAY", "TUESDAY"],
        "correctIndex": 2,
    },
    {
        "text": "Find the odd one out:",
        "options": ["24", "36", "40", "48"],
        "correctIndex": 2,
    },
    {
        "text": "A shop gives 20% discount on a shirt marked at Rs 1500. What is the selling price?",
        "options": ["Rs 1100", "Rs 1200", "Rs 1250", "Rs 1300"],
        "correctIndex": 1,
    },
    {
        "text": "A number is increased from 80 to 100. What is the percentage increase?",
        "options": ["20%", "25%", "30%", "35%"],
        "correctIndex": 1,
    },
    {
        "text": "If 7 pens cost Rs 84, what is the cost of 15 pens?",
        "options": ["Rs 170", "Rs 175", "Rs 180", "Rs 185"],
        "correctIndex": 2,
    },
    {
        "text": "A car travels 180 km in 3 hours. At the same speed, how far in 5 hours?",
        "options": ["250 km", "280 km", "300 km", "320 km"],
        "correctIndex": 2,
    },
    {
        "text": "A student scores 72 marks out of 120. What is the percentage score?",
        "options": ["50%", "55%", "60%", "65%"],
        "correctIndex": 2,
    },
    {
        "text": "What is the output of: x=3, y=2, x=x+y; y=x-y; print(x,y)?",
        "options": ["5 2", "3 5", "5 3", "2 5"],
        "correctIndex": 0,
    },
    {
        "text": "What does this loop print: sum=0; for i=1 to 4: sum=sum+i; print(sum)?",
        "options": ["4", "6", "10", "15"],
        "correctIndex": 2,
    },
    {
        "text": "In a Fibonacci-style loop starting with a=1, b=1 for 3 steps, what is the final c?",
        "options": ["2", "3", "5", "6"],
        "correctIndex": 2,
    },
    {
        "text": "A and B together can complete a task in 8 days. B alone in 12 days. In how many days can A alone complete it?",
        "options": ["20 days", "24 days", "30 days", "32 days"],
        "correctIndex": 1,
    },
    {
        "text": "A clock shows 4:00. What is the angle between the hour and minute hands?",
        "options": ["90 degrees", "120 degrees", "150 degrees", "180 degrees"],
        "correctIndex": 1,
    },
    {
        "text": "In a box, there are 4 red, 5 blue, and 3 green balls. Minimum draws to be sure of at least one blue ball?",
        "options": ["4", "5", "9", "10"],
        "correctIndex": 3,
    },
]

# Fixed MCQ set for Round 2 (Logical Reasoning, 15 questions)
REAL_ROUND2_QUESTIONS: List[Dict[str, Any]] = [
    # Direction sense
    {
        "text": "Aman walks 4 km north, then turns right and walks 3 km. Again he turns right and walks 4 km. How far and in which direction is he from the starting point?",
        "options": [
            "3 km east",
            "3 km west",
            "4 km east",
            "4 km west",
        ],
        "correctIndex": 1,
    },
    {
        "text": "Rita is facing east. She turns left, then left again, and then right. In which direction is she facing now?",
        "options": [
            "North",
            "West",
            "East",
            "South",
        ],
        "correctIndex": 3,
    },

    # Blood relation
    {
        "text": "Pointing to a photograph, Raj said, 'He is the son of my father's only son.' How is the boy related to Raj?",
        "options": [
            "Brother",
            "Son",
            "Cousin",
            "Nephew",
        ],
        "correctIndex": 1,
    },
    {
        "text": "Priya introduces a man as the son of the only son of her grandfather. How is the man related to Priya?",
        "options": [
            "Brother",
            "Uncle",
            "Cousin",
            "Father",
        ],
        "correctIndex": 0,
    },

    # Ranking
    {
        "text": "In a class of 40 students, Ravi ranks 10th from the top. What is his rank from the bottom?",
        "options": [
            "30th",
            "31st",
            "32nd",
            "33rd",
        ],
        "correctIndex": 1,
    },
    {
        "text": "Among five friends A, B, C, D and E, A is taller than B but shorter than C. D is taller than C. E is shorter than B. Who is the tallest?",
        "options": [
            "A",
            "B",
            "C",
            "D",
        ],
        "correctIndex": 3,
    },

    # Statements & conclusions
    {
        "text": "Statement: All teachers are educated. Some educated people are researchers. Conclusion I: Some teachers are researchers. Conclusion II: Some researchers are educated. Which is true?",
        "options": [
            "Only I follows",
            "Only II follows",
            "Both I and II follow",
            "Neither I nor II follows",
        ],
        "correctIndex": 1,
    },
    {
        "text": "Statement: Some pens are books. All books are boxes. Conclusion: Some pens are boxes. What is the correct option?",
        "options": [
            "Conclusion definitely follows",
            "Conclusion definitely does not follow",
            "Conclusion is doubtful",
            "Conclusion is wrong statement",
        ],
        "correctIndex": 0,
    },

    # Syllogism
    {
        "text": "Statements: All dogs are animals. Some animals are wild. Conclusions: I. Some dogs are wild. II. Some wild are animals. Which is correct?",
        "options": [
            "Only I follows",
            "Only II follows",
            "Both I and II follow",
            "Neither I nor II follows",
        ],
        "correctIndex": 1,
    },
    {
        "text": "Statements: All engineers are graduates. No graduate is illiterate. Conclusions: I. No engineer is illiterate. II. Some engineers are illiterate. Which is correct?",
        "options": [
            "Only I follows",
            "Only II follows",
            "Both I and II follow",
            "Neither I nor II follows",
        ],
        "correctIndex": 0,
    },

    # Seating arrangement (simple)
    {
        "text": "Four friends P, Q, R and S sit in a row facing north. Q is to the immediate right of P. R is to the right of Q. S is to the left of P. Who sits at the extreme right?",
        "options": [
            "P",
            "Q",
            "R",
            "S",
        ],
        "correctIndex": 2,
    },
    {
        "text": "Six persons A, B, C, D, E and F are sitting in a row. C is between B and D. E is to the immediate right of D. A is at one end. Who is sitting at the other end?",
        "options": [
            "B",
            "C",
            "E",
            "F",
        ],
        "correctIndex": 3,
    },

    # Odd one out (logical)
    {
        "text": "Find the odd one out:",
        "options": [
            "North",
            "East",
            "South",
            "Square",
        ],
        "correctIndex": 3,
    },
    {
        "text": "Find the odd one out:",
        "options": [
            "Mother",
            "Father",
            "Brother",
            "Chair",
        ],
        "correctIndex": 3,
    },

    # Misc logic
    {
        "text": "If in a certain code, ROAD is written as SPBE, how is PATH written in that code? (Each letter shifted +1)",
        "options": [
            "QBUS",
            "QBIU",
            "QBUI",
            "QBTI",
        ],
        "correctIndex": 2,
    },
]

# Fixed MCQ set for Round 3 (Analytical/Quant + Logical mix, 10 questions)
REAL_ROUND3_QUESTIONS: List[Dict[str, Any]] = [
    {
        "text": "A shopkeeper buys an article for Rs 400 and sells it for Rs 500. What is his profit percentage?",
        "options": [
            "20%",
            "22.5%",
            "25%",
            "30%",
        ],
        "correctIndex": 2,
    },
    {
        "text": "The average of five numbers is 28. The sum of four of them is 110. What is the fifth number?",
        "options": [
            "24",
            "26",
            "30",
            "34",
        ],
        "correctIndex": 3,
    },
    {
        "text": "A train 150 m long passes a pole in 15 seconds. What is its speed in km/h?",
        "options": [
            "36 km/h",
            "45 km/h",
            "54 km/h",
            "60 km/h",
        ],
        "correctIndex": 2,
    },
    {
        "text": "If 3x - 5 = 16, what is the value of x?",
        "options": [
            "5",
            "6",
            "7",
            "8",
        ],
        "correctIndex": 2,
    },
    {
        "text": "In a certain code, 1 is written as 3, 2 as 5, 3 as 7, and so on (adding 2). What is the code for 6?",
        "options": [
            "10",
            "11",
            "12",
            "13",
        ],
        "correctIndex": 3,
    },
    {
        "text": "Two pipes can fill a tank in 20 minutes and 30 minutes respectively. If both are opened together, in how many minutes will the tank be full?",
        "options": [
            "10",
            "12",
            "15",
            "18",
        ],
        "correctIndex": 1,
    },
    {
        "text": "The ratio of the ages of A and B is 3:5. After 6 years, their ages will be 21 and 35 respectively. What is A's present age?",
        "options": [
            "9",
            "12",
            "15",
            "18",
        ],
        "correctIndex": 1,
    },
    {
        "text": "Four consecutive odd numbers sum to 88. What is the smallest of them?",
        "options": [
            "19",
            "21",
            "23",
            "25",
        ],
        "correctIndex": 1,
    },
    {
        "text": "If 40% of a number is 120, what is 25% of the same number?",
        "options": [
            "60",
            "70",
            "75",
            "90",
        ],
        "correctIndex": 2,
    },
    {
        "text": "In a mixture of 50 liters, the ratio of milk to water is 3:2. How much water must be added to make the ratio 3:3?",
        "options": [
            "5 liters",
            "10 liters",
            "15 liters",
            "20 liters",
        ],
        "correctIndex": 1,
    },
]

# --- Multi-round Interview Endpoints (MCQ-only) ---
@api_router.get("/interview/getRoundQuestions")
async def get_round_questions(round: int):
    try:
        r = int(round)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid round")
    questions = build_round_questions(r)
    # Return all questions; no artificial limits
    return {"round": r, "count": len(questions), "questions": questions, "duration_sec": ROUND_DURATIONS_SEC.get(r)}


class SubmitRoundPayload(BaseModel):
    interview_id: str
    round: int
    answers: List[Dict[str, Any]] = []
    duration_sec: Optional[int] = None
    warnings: Optional[int] = 0
    webcam_url: Optional[str] = None
    screen_url: Optional[str] = None


@api_router.post("/interview/submitRound")
async def submit_round(data: SubmitRoundPayload):
    # Basic validation: interview exists; derive candidate_id from interview to avoid import-order issues
    interview = await db.interviews.find_one({"id": data.interview_id})
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    candidate_id = interview.get("candidate_id")
    if not candidate_id:
        raise HTTPException(status_code=400, detail="Interview missing candidate_id")

    round_num = int(data.round)
    now = datetime.now(timezone.utc)

    # Store or upsert per-round raw submission (for audit/history)
    submission_doc = {
        "interview_id": data.interview_id,
        "candidate_id": candidate_id,
        "round": round_num,
        "answers": data.answers,
        "duration_sec": int(data.duration_sec or 0),
        "warnings": int(data.warnings or 0),
        "submitted_at": now,
    }
    await db.interview_round_submissions.update_one(
        {"interview_id": data.interview_id, "candidate_id": candidate_id, "round": round_num},
        {"$set": submission_doc},
        upsert=True,
    )

    # --- Per-answer storage in candidate_answers ---
    # Build correct answer map from the round question set
    questions_for_round = build_round_questions(round_num)
    correct_map: Dict[str, int | None] = {}
    for q in questions_for_round:
        qid = q.get("id")
        if qid is not None:
            correct_map[str(qid)] = q.get("correctIndex")

    answer_docs = []
    correct_count = 0
    # wrong_count will be derived from total questions so that unanswered count as wrong

    for item in data.answers or []:
        qid = str(item.get("questionId")) if item.get("questionId") is not None else None
        # Frontend may send the selected option index as a string (e.g. "1") or an int; normalize to int when possible
        raw_selected = item.get("answer")
        selected_option: Optional[int]
        if isinstance(raw_selected, int):
            selected_option = raw_selected
        else:
            try:
                selected_option = int(raw_selected) if raw_selected is not None and str(raw_selected).strip() != "" else None
            except (TypeError, ValueError):
                selected_option = None
        correct_idx = correct_map.get(qid) if qid is not None else None
        is_correct = (
            isinstance(selected_option, int)
            and isinstance(correct_idx, int)
            and selected_option == correct_idx
        )

        if is_correct:
            correct_count += 1

        if qid is not None:
            answer_docs.append(
                {
                    "interview_id": data.interview_id,
                    "candidate_id": candidate_id,
                    "round": round_num,
                    "question_id": qid,
                    "selected_option": selected_option,
                    "is_correct": bool(is_correct),
                    "time_spent_sec": item.get("timeSpent"),
                    "timestamp": now,
                }
            )

    if answer_docs:
        # Append; we keep history of each submission attempt
        await db.candidate_answers.insert_many(answer_docs)

    total_questions = len(questions_for_round)
    wrong_count = max(0, total_questions - correct_count)
    percentage = float((correct_count / total_questions) * 100.0) if total_questions > 0 else 0.0
    round_status = "Passed" if percentage >= 60.0 else "Failed"

    # --- Round-wise score storage in round_results ---
    round_result_doc = {
        "interview_id": data.interview_id,
        "candidate_id": candidate_id,
        "round": round_num,
        "correctAnswers": correct_count,
        "wrongAnswers": wrong_count,
        "percentage": percentage,
        "roundStatus": round_status,
        "warnings": int(data.warnings or 0),
        "duration_sec": int(data.duration_sec or 0),
        "webcamUrl": data.webcam_url,
        "screenUrl": data.screen_url,
        "updated_at": now,
    }
    await db.round_results.update_one(
        {"interview_id": data.interview_id, "candidate_id": candidate_id, "round": round_num},
        {"$set": round_result_doc},
        upsert=True,
    )

    # After last round, mark interview completed and set candidate finalStatus
    completed = False
    if round_num >= 3:
        completed = True
        await db.interviews.update_one(
            {"id": data.interview_id},
            {"$set": {"status": "completed", "ended_at": now}},
        )

        # Determine finalStatus based on all round_results for this interview
        all_results = await db.round_results.find(
            {"interview_id": data.interview_id, "candidate_id": candidate_id}
        ).to_list(10)
        # Consider only rounds 1-3, require all marked as Passed
        has_all_rounds = any(r.get("round") == 1 for r in all_results) and any(
            r.get("round") == 2 for r in all_results
        ) and any(r.get("round") == 3 for r in all_results)
        all_passed = has_all_rounds and all(
            r.get("roundStatus") == "Passed" for r in all_results if r.get("round") in [1, 2, 3]
        )
        final_status = "Selected" if all_passed else "Rejected"
        await db.candidates.update_one(
            {"id": candidate_id},
            {"$set": {"finalStatus": final_status}},
        )

    return {
        "ok": True,
        "completed": completed,
        "nextRound": None if completed else (round_num + 1),
        "roundScore": correct_count,
        "totalQuestions": total_questions,
        "percentage": percentage,
        "roundStatus": round_status,
    }

def build_round_questions(round_num: int) -> List[Dict[str, Any]]:
    """Build MCQ list for a given round.
    Attempts to use assigned question set in DB if present later; for now, generate MCQs with no artificial limits.
    """
    total = ROUND_COUNTS.get(round_num)
    if not total:
        raise HTTPException(status_code=400, detail="invalid round")

    # Round 1: use fixed real aptitude (mixed) questions
    if int(round_num) == 1:
        questions: List[Dict[str, Any]] = []
        for idx, q in enumerate(REAL_ROUND1_QUESTIONS[:total]):
            questions.append(
                {
                    "id": f"r1q{idx+1}",
                    "text": q["text"],
                    "options": q["options"],
                    "correctIndex": q["correctIndex"],
                    "max_duration_sec": 60,
                }
            )
        return questions

    # Round 2: use fixed logical reasoning questions
    if int(round_num) == 2:
        questions: List[Dict[str, Any]] = []
        for idx, q in enumerate(REAL_ROUND2_QUESTIONS[:total]):
            questions.append(
                {
                    "id": f"r2q{idx+1}",
                    "text": q["text"],
                    "options": q["options"],
                    "correctIndex": q["correctIndex"],
                    "max_duration_sec": 60,
                }
            )
        return questions

    # Round 3: use fixed analytical/quant/logical mix questions
    if int(round_num) == 3:
        questions: List[Dict[str, Any]] = []
        for idx, q in enumerate(REAL_ROUND3_QUESTIONS[:total]):
            questions.append(
                {
                    "id": f"r3q{idx+1}",
                    "text": q["text"],
                    "options": q["options"],
                    "correctIndex": q["correctIndex"],
                    "max_duration_sec": 60,
                }
            )
        return questions

    # Other rounds (if any) keep using generated MCQs
    prefix = {1: "Speed Test", 2: "Logical Reasoning", 3: "Analytical Reasoning"}.get(round_num, "Round")
    questions: List[Dict[str, Any]] = []
    for i in range(total):
        questions.append(_generate_mcq(i, prefix))
    return questions

# Enums for ATS
class PipelineStage(str, Enum):
    NEW = "new"
    SCREENING = "screening"
    PHONE_SCREEN = "phone_screen"
    TECHNICAL_INTERVIEW = "technical_interview"
    FINAL_INTERVIEW = "final_interview"
    OFFER = "offer"
    HIRED = "hired"
    REJECTED = "rejected"

class JobStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    CLOSED = "closed"

class UserRole(str, Enum):
    RECRUITER = "recruiter"
    CANDIDATE = "candidate"

# Define Models
class Company(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    domain: str
    size: str  # "1-10", "11-50", "51-200", "200+"
    industry: str
    website: Optional[str] = None
    logo_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Recruiter(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    full_name: str
    company_id: str
    role: str = "recruiter"  # recruiter, admin, manager
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CandidateUser(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    full_name: str
    phone: str
    location: Optional[str] = None
    current_title: Optional[str] = None
    current_company: Optional[str] = None
    experience_years: int
    education: Optional[str] = None
    skills: List[str] = []
    resume_url: Optional[str] = None
    resume_text: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    bio: Optional[str] = None
    expected_salary: Optional[int] = None
    availability: str = "immediate"  # immediate, 2_weeks, 1_month, 3_months
    is_email_verified: bool = False
    is_phone_verified: bool = False
    finalStatus: Optional[str] = None  # Selected, Rejected, Pending
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RecruiterLogin(BaseModel):
    email: EmailStr
    password: str

class RecruiterRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    company_name: str
    company_domain: str
    company_size: str
    industry: str

class CandidateLogin(BaseModel):
    email: EmailStr
    password: str

class CandidateRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str
    location: str
    current_title: str
    current_company: str
    experience_years: int
    education: str
    skills: List[str]
    expected_salary: Optional[int] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    bio: Optional[str] = None

class EmailVerification(BaseModel):
    user_id: str
    email: str
    verification_code: str
    expires_at: datetime
    is_verified: bool = False

class PhoneVerification(BaseModel):
    user_id: str
    phone: str
    otp_code: str
    expires_at: datetime
    is_verified: bool = False

class Job(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    company_id: str
    recruiter_id: str
    description: str
    requirements: List[str]
    location: str
    job_type: str  # Full-time, Part-time, Contract
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    skills: List[str]
    department: str
    experience_level: str  # Entry, Mid, Senior
    status: JobStatus = JobStatus.DRAFT
    posted_date: Optional[datetime] = None
    application_deadline: Optional[datetime] = None
    # Enhanced requirements for detailed job posting
    technical_requirements: List[str] = []
    soft_skills: List[str] = []
    certifications: List[str] = []
    education_requirements: str = ""
    work_environment: str = ""  # Remote, Hybrid, On-site
    benefits: List[str] = []
    interview_process: List[str] = []  # Steps in interview process
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CandidateApplication(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_id: str
    candidate_id: str
    company_id: str
    cover_letter: str
    stage: PipelineStage = PipelineStage.NEW
    score: Optional[int] = None  # 1-10 rating
    applied_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Interview(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    application_id: str
    candidate_id: str
    interviewer_id: str
    job_id: str
    company_id: str
    interview_type: str = "video"  # video, phone, onsite
    scheduled_date: datetime
    duration_minutes: int = 60
    meeting_link: Optional[str] = None
    status: str = "scheduled"  # scheduled, in_progress, completed, cancelled, no_show
    feedback: Optional[str] = None
    rating: Optional[int] = None  # 1-10
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Note(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    application_id: str
    recruiter_id: str
    content: str
    type: str = "general"  # general, interview, feedback
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InterviewRecording(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    interview_id: str
    candidate_id: str
    recruiter_id: str
    webcam_recording_url: Optional[str] = None
    screen_recording_url: Optional[str] = None
    audio_recording_url: Optional[str] = None
    security_log: List[Dict] = []
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ended_at: Optional[datetime] = None
    status: str = "recording"  # recording, completed, failed
    file_size_mb: Optional[float] = None

class VideoSubmission(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    candidate_id: str
    candidate_email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    job_id: Optional[str] = None
    company_id: Optional[str] = None
    video_url: str
    size_bytes: Optional[int] = None
    duration_sec: Optional[float] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SecurityViolation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    interview_id: str
    candidate_id: str
    violation_type: str
    description: str
    severity: str = "warning"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Candidate submission (answers) model
class CandidateSubmission(BaseModel):
    interview_id: str
    candidate_id: str
    answers: List[Dict[str, Any]] = []  # free-form list of Q&A blocks
    notes: Optional[str] = None
    ai_scores: Optional[Dict[str, Any]] = None
    frontCamUrl: Optional[str] = None
    screenUrl: Optional[str] = None
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    screenshot_url: Optional[str] = None

# Enhanced AI Monitoring Models
class AIAnalysisResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    interview_id: str
    candidate_id: str
    analysis_type: str  # facial, voice, movement, screen
    confidence_score: float  # 0.0 to 1.0
    authenticity_score: float  # 0.0 to 1.0
    detected_issues: List[str] = []
    recommendations: List[str] = []
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FacialAnalysis(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    interview_id: str
    candidate_id: str
    eye_movement_score: float
    head_movement_score: float
    facial_expression_score: float
    attention_score: float
    stress_indicators: List[str] = []
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class VoiceAnalysis(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    interview_id: str
    candidate_id: str
    voice_clarity_score: float
    speech_pattern_score: float
    background_noise_score: float
    voice_authenticity_score: float
    detected_issues: List[str] = []
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ScreenAnalysis(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    interview_id: str
    candidate_id: str
    tab_switching_detected: bool
    unauthorized_apps_detected: List[str] = []
    screen_sharing_quality: float
    focus_score: float
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SecureInterviewSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    interview_id: str
    candidate_id: str
    recruiter_id: str
    session_start: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    session_end: Optional[datetime] = None
    is_active: bool = True
    tab_locking_enabled: bool = True
    screen_sharing_enabled: bool = True
    webcam_enabled: bool = True
    ai_monitoring_enabled: bool = True
    overall_authenticity_score: Optional[float] = None
    ai_decision: Optional[str] = None  # "PASS", "FAIL", "REVIEW_REQUIRED"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Question Sets and Evaluation Models (Jobma-like one-way interview features)
class InterviewQuestion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    type: str = "video"  # video, text, audio
    max_duration_sec: int = 120
    guidelines: Optional[str] = None

class QuestionSet(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    name: str
    description: Optional[str] = None
    questions: List[InterviewQuestion] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RecruiterEvaluation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    interview_id: str
    recruiter_id: str
    rubric_scores: Dict[str, int] = {}  # e.g., {"communication": 4, "technical": 5}
    overall_score: Optional[int] = None  # 1-10
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Integration Webhooks (RecruitCRM-like integration)
class WebhookEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_type: str  # e.g., "candidate_applied", "interview_scheduled"
    event_data: Dict[str, Any] = {}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WebhookSubscription(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    event_types: List[str] = []
    webhook_url: str
    secret_key: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# AI Scheduler Models
class ScheduleProposeRequest(BaseModel):
    job_id: str
    candidate_id: str
    slot_minutes: int = 60
    days_ahead: int = 7
    # Working hours in local time (24h)
    work_start_hour: int = 9
    work_end_hour: int = 18

class ScheduleBookRequest(BaseModel):
    job_id: str
    candidate_id: str
    scheduled_date: datetime  # ISO timestamp

class ProposedSlot(BaseModel):
    start: datetime
    end: datetime

# AI Evaluation Models
class AIDecision(BaseModel):
    decision: str  # PASS | FAIL | REVIEW_REQUIRED
    scores: Dict[str, Any] = {}
    reasons: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# WebSocket Connection Manager for Real-time Interview Monitoring
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.interview_sessions: Dict[str, Dict] = {}

    async def connect(self, websocket: WebSocket, interview_id: str, user_type: str):
        await websocket.accept()
        if interview_id not in self.active_connections:
            self.active_connections[interview_id] = []
        self.active_connections[interview_id].append(websocket)
        
        # Store session info
        if interview_id not in self.interview_sessions:
            self.interview_sessions[interview_id] = {
                'candidate': None,
                'recruiters': [],
                'started_at': datetime.now(timezone.utc)
            }

    def disconnect(self, websocket: WebSocket, interview_id: str):
        if interview_id in self.active_connections:
            self.active_connections[interview_id].remove(websocket)
            if not self.active_connections[interview_id]:
                del self.active_connections[interview_id]
                
        # Clean up session info
        if interview_id in self.interview_sessions:
            session = self.interview_sessions[interview_id]
            if session['candidate'] == websocket:
                session['candidate'] = None
            elif websocket in session['recruiters']:
                session['recruiters'].remove(websocket)

    async def send_to_recruiters(self, interview_id: str, message: dict):
        if interview_id in self.interview_sessions:
            recruiters = self.interview_sessions[interview_id]['recruiters']
            for recruiter_ws in recruiters:
                try:
                    await recruiter_ws.send_text(json.dumps(message))
                except:
                    pass  # Handle disconnected recruiters

    async def send_to_candidate(self, interview_id: str, message: dict):
        if interview_id in self.interview_sessions:
            candidate_ws = self.interview_sessions[interview_id]['candidate']
            if candidate_ws:
                try:
                    await candidate_ws.send_text(json.dumps(message))
                except:
                    pass  # Handle disconnected candidate

manager = ConnectionManager()

# ----------------------
# Proctoring / LiveKit Helpers
# ----------------------

def create_one_time_phone_token(session_id: str) -> str:
    payload = {
        "sid": session_id,
        "type": "phone",
        "jti": secrets.token_urlsafe(16),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def verify_one_time_phone_token(token: str) -> Dict[str, Any]:
    decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])  # raises on invalid/expired
    if decoded.get("type") != "phone":
        raise HTTPException(status_code=400, detail="Invalid token type")
    return decoded


def build_livekit_access_token(room: str, identity: str, name: str, can_publish: bool, can_subscribe: bool) -> str:
    # LiveKit AccessToken is a JWT signed with API secret, with grants in 'video'
    now = datetime.now(timezone.utc)
    payload = {
        "iss": LIVEKIT_API_KEY,
        "sub": identity,
        "name": name,
        "nbf": int(now.timestamp()) - 1,
        "exp": int((now + timedelta(hours=1)).timestamp()),
        "video": {
            "room": room,
            "roomJoin": True,
            "canPublish": can_publish,
            "canSubscribe": can_subscribe
        }
    }
    return jwt.encode(payload, LIVEKIT_API_SECRET, algorithm="HS256")


# in-memory session store for demo
_session_store: Dict[str, Dict[str, Any]] = {}
_record_state: Dict[str, bool] = {}

# Helper functions
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

def generate_verification_code() -> str:
    return ''.join(random.choices(string.digits, k=6))

# --- Simple login audit helper ---
async def log_login_event(role: str, user_id: str, method: str, email: str = None, success: bool = True):
    try:
        await db.login_events.insert_one({
            "user_id": user_id,
            "role": role,
            "email": email,
            "method": method,  # e.g., 'clerk-sync', 'otp-verify', 'native-password'
            "success": bool(success),
            "timestamp": datetime.now(timezone.utc),
        })
    except Exception:
        # Best-effort; do not block auth flows on logging errors
        pass

# ----------------------
# S3 Helper Functions
# ----------------------
def _s3_key(session_id: str, filename: str) -> str:
    return f"{session_id}/{filename}"

def s3_upload_bytes(session_id: str, filename: str, content: bytes, content_type: str | None = None) -> None:
    if not S3_CLIENT or not AWS_S3_BUCKET:
        raise HTTPException(status_code=500, detail="S3 not configured")
    extra = {"ContentType": content_type} if content_type else {}
    S3_CLIENT.put_object(Bucket=AWS_S3_BUCKET, Key=_s3_key(session_id, filename), Body=content, **extra)

def s3_list_session(session_id: str) -> list[dict]:
    if not S3_CLIENT or not AWS_S3_BUCKET:
        raise HTTPException(status_code=500, detail="S3 not configured")
    prefix = f"{session_id}/"
    paginator = S3_CLIENT.get_paginator('list_objects_v2')
    items = []
    for page in paginator.paginate(Bucket=AWS_S3_BUCKET, Prefix=prefix):
        for obj in page.get('Contents', []) or []:
            key = obj['Key']
            if key.endswith('/'):
                continue
            filename = key.split('/', 1)[1]
            items.append({
                "filename": filename,
                "size": obj.get('Size'),
                "last_modified": obj.get('LastModified').isoformat() if obj.get('LastModified') else None,
            })
    return items

def s3_presign_get(session_id: str, filename: str, expires_in: int = 3600) -> str:
    if not S3_CLIENT or not AWS_S3_BUCKET:
        raise HTTPException(status_code=500, detail="S3 not configured")
    return S3_CLIENT.generate_presigned_url(
        'get_object',
        Params={'Bucket': AWS_S3_BUCKET, 'Key': _s3_key(session_id, filename)},
        ExpiresIn=expires_in
    )

# ----------------------
# Proctoring API
# ----------------------

class CreateSessionResponse(BaseModel):
    sessionId: str
    phoneJoinToken: str


@api_router.post("/session", response_model=CreateSessionResponse)
async def create_session():
    session_id = str(uuid.uuid4())[:12]
    _session_store[session_id] = {
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "usedPhoneTokens": set(),
    }
    token = create_one_time_phone_token(session_id)
    return {"sessionId": session_id, "phoneJoinToken": token}


class TokenExchangeRequest(BaseModel):
    token: str
    identity: Optional[str] = None


@api_router.post("/phone-join-exchange")
async def phone_join_exchange(payload: TokenExchangeRequest):
    if not payload.token:
        raise HTTPException(status_code=400, detail="token required")
    decoded = verify_one_time_phone_token(payload.token)
    sid = decoded.get("sid")
    store = _session_store.get(sid)
    if not store:
        raise HTTPException(status_code=404, detail="session not found")
    used = store.get("usedPhoneTokens")
    # Convert set stored as set or list
    if isinstance(used, list):
        used = set(used)
        store["usedPhoneTokens"] = used
    if payload.token in used:
        raise HTTPException(status_code=409, detail="token already used")
    used.add(payload.token)

    identity = payload.identity or f"phone-{str(uuid.uuid4())[:8]}"
    lk = build_livekit_access_token(room=sid, identity=identity, name="Phone Camera", can_publish=True, can_subscribe=False)
    # Audit: clerk-sync login
    await log_login_event("candidate", identity, method="clerk-sync", success=True)
    return {"sessionId": sid, "livekitToken": lk, "wsUrl": LIVEKIT_WS_URL}


class JoinTokenRequest(BaseModel):
    sessionId: str
    identity: Optional[str] = None


@api_router.post("/laptop-join-token")
async def laptop_join_token(payload: JoinTokenRequest):
    sid = payload.sessionId
    if not sid:
        raise HTTPException(status_code=400, detail="sessionId required")
    if sid not in _session_store:
        raise HTTPException(status_code=404, detail="session not found")
    identity = payload.identity or f"laptop-{str(uuid.uuid4())[:8]}"
    lk = build_livekit_access_token(room=sid, identity=identity, name="Laptop Camera", can_publish=True, can_subscribe=True)
    return {"sessionId": sid, "livekitToken": lk, "wsUrl": LIVEKIT_WS_URL}


@api_router.post("/interviewer-join-token")
async def interviewer_join_token(payload: JoinTokenRequest):
    sid = payload.sessionId
    if not sid:
        raise HTTPException(status_code=400, detail="sessionId required")
    if sid not in _session_store:
        raise HTTPException(status_code=404, detail="session not found")
    identity = payload.identity or f"hr-{str(uuid.uuid4())[:8]}"
    lk = build_livekit_access_token(room=sid, identity=identity, name="Interviewer", can_publish=False, can_subscribe=True)
    return {"sessionId": sid, "livekitToken": lk, "wsUrl": LIVEKIT_WS_URL}


# ----------------------
# AI Scheduler Endpoints
# ----------------------

def _overlaps(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    return max(a_start, b_start) < min(a_end, b_end)


@api_router.post("/ai/scheduler/propose", response_model=List[ProposedSlot])
async def ai_scheduler_propose(req: ScheduleProposeRequest, credentials: HTTPAuthorizationCredentials = Depends(security)):
    # Decode recruiter from token (avoid early reference to get_current_recruiter)
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        if payload.get("role") != "recruiter":
            raise HTTPException(status_code=403, detail="Access denied")
        recruiter_doc = await db.recruiters.find_one({"id": payload["user_id"]})
        if not recruiter_doc:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    now = datetime.now(timezone.utc)
    company_interviews = await db.interviews.find({
        "company_id": recruiter_doc["company_id"],
        "status": {"$in": ["scheduled", "in_progress"]}
    }).to_list(1000)
    candidate_interviews = await db.interviews.find({
        "candidate_id": req.candidate_id,
        "status": {"$in": ["scheduled", "in_progress"]}
    }).to_list(1000)

    conflicts = []
    for it in company_interviews + candidate_interviews:
        st = it.get("scheduled_date")
        dur = int(it.get("duration_minutes") or 60)
        if isinstance(st, str):
            try:
                st = datetime.fromisoformat(st)
            except Exception:
                st = None
        if st and st.tzinfo is None:
            st = st.replace(tzinfo=timezone.utc)
        if st:
            conflicts.append((st, st + timedelta(minutes=dur)))

    slot_len = max(15, int(req.slot_minutes))
    days = max(1, min(30, int(req.days_ahead)))
    work_start = max(0, min(23, int(req.work_start_hour)))
    work_end = max(work_start + 1, min(24, int(req.work_end_hour)))

    proposals: List[ProposedSlot] = []
    for d in range(days):
        day = (now + timedelta(days=d)).date()
        start_dt = datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=work_start)
        end_dt = datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=work_end)
        t = max(start_dt, now)
        while t + timedelta(minutes=slot_len) <= end_dt and len(proposals) < 12:
            slot_start = t
            slot_end = t + timedelta(minutes=slot_len)
            has_conflict = any(_overlaps(slot_start, slot_end, c0, c1) for (c0, c1) in conflicts)
            if not has_conflict:
                proposals.append(ProposedSlot(start=slot_start, end=slot_end))
            t += timedelta(minutes=slot_len)
        if len(proposals) >= 12:
            break

    return proposals


@api_router.post("/ai/scheduler/book", response_model=Interview)
async def ai_scheduler_book(req: ScheduleBookRequest, credentials: HTTPAuthorizationCredentials = Depends(security)):
    # Decode recruiter from token (avoid early reference to get_current_recruiter)
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        if payload.get("role") != "recruiter":
            raise HTTPException(status_code=403, detail="Access denied")
        recruiter_doc = await db.recruiters.find_one({"id": payload["user_id"]})
        if not recruiter_doc:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    st = req.scheduled_date
    if st.tzinfo is None:
        st = st.replace(tzinfo=timezone.utc)
    en = st + timedelta(minutes=60)

    existing = await db.interviews.find({
        "company_id": recruiter_doc["company_id"],
        "status": {"$in": ["scheduled", "in_progress"]}
    }).to_list(1000)
    for it in existing:
        it_st = it.get("scheduled_date")
        dur = int(it.get("duration_minutes") or 60)
        if isinstance(it_st, str):
            try:
                it_st = datetime.fromisoformat(it_st)
            except Exception:
                it_st = None
        if it_st and it_st.tzinfo is None:
            it_st = it_st.replace(tzinfo=timezone.utc)
        if it_st and _overlaps(st, en, it_st, it_st + timedelta(minutes=dur)):
            raise HTTPException(status_code=409, detail="Time slot conflicts with an existing interview")

    new_interview = Interview(
        application_id="",
        candidate_id=req.candidate_id,
        interviewer_id=recruiter_doc["id"],
        job_id=req.job_id,
        company_id=recruiter_doc["company_id"],
        interview_type="video",
        scheduled_date=st,
        duration_minutes=60,
        status="scheduled",
    )
    await db.interviews.insert_one(new_interview.dict())
    return new_interview

@api_router.get("/recordings/{session_id}")
async def list_recordings(session_id: str):
    # Lists files from S3 or local recordings dir
    if VIDEO_STORAGE == "s3":
        try:
            items = s3_list_session(session_id)
            files = []
            for it in items:
                presigned = s3_presign_get(session_id, it["filename"], expires_in=3600)
                files.append({
                    "filename": it["filename"],
                    "path": f"/api/recordings/{session_id}/{it['filename']}",
                    "presignedUrl": presigned,
                    "size": it.get("size"),
                    "last_modified": it.get("last_modified"),
                })
            return {"files": files}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"S3 list error: {e}")
    else:
        session_dir = Path(RECORDINGS_DIR) / session_id
        files = []
        if session_dir.exists():
            for f in session_dir.iterdir():
                if f.is_file() and f.suffix.lower() in {".webm", ".mp4", ".mkv"}:
                    files.append({"filename": f.name, "path": f"/api/recordings/{session_id}/{f.name}"})
        return {"files": files}


@api_router.get("/recordings/{session_id}/{filename}")
async def download_recording(session_id: str, filename: str):
    if VIDEO_STORAGE == "s3":
        try:
            presigned = s3_presign_get(session_id, filename, expires_in=3600)
            return RedirectResponse(url=presigned, status_code=307)
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"S3 file not found or error: {e}")
    else:
        target = Path(RECORDINGS_DIR) / session_id / filename
        if not target.exists():
            raise HTTPException(status_code=404, detail="File not found")
        return FileResponse(str(target))


@api_router.post("/recordings/upload")
async def upload_recording(sessionId: str, source: str, file: UploadFile = File(...)):
    """
    Save uploaded recording file to RECORDINGS_DIR/<sessionId>/
    source: 'laptop' | 'phone'
    """
    if not sessionId:
        raise HTTPException(status_code=400, detail="sessionId required")
    if source not in {"laptop", "phone"}:
        raise HTTPException(status_code=400, detail="invalid source")

    ts = int(datetime.now(timezone.utc).timestamp())
    suffix = Path(file.filename or '').suffix or '.webm'
    safe_suffix = suffix if len(suffix) <= 6 else '.webm'
    filename = f"{source}_{ts}{safe_suffix}"
    content = await file.read()

    if VIDEO_STORAGE == "s3":
        try:
            s3_upload_bytes(sessionId, filename, content, getattr(file, 'content_type', None))
            presigned = s3_presign_get(sessionId, filename, expires_in=3600)
            return {
                "ok": True,
                "filename": filename,
                "url": f"/api/recordings/{sessionId}/{filename}",
                "presignedUrl": presigned,
                "storage": "s3"
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"S3 upload error: {e}")
    else:
        session_dir = Path(RECORDINGS_DIR) / sessionId
        session_dir.mkdir(parents=True, exist_ok=True)
        dest = session_dir / filename
        with open(dest, 'wb') as f:
            f.write(content)
        return {
            "ok": True,
            "filename": filename,
            "url": f"/api/recordings/{sessionId}/{filename}",
            "storage": "local"
        }


# --- Recording state control (for client MediaRecorder) ---
class RecordingStateRequest(BaseModel):
    sessionId: str
    recording: bool


@api_router.post("/recordings/state")
async def set_recording_state(req: RecordingStateRequest):
    if not req.sessionId:
        raise HTTPException(status_code=400, detail="sessionId required")
    _record_state[req.sessionId] = bool(req.recording)
    return {"ok": True, "sessionId": req.sessionId, "recording": _record_state[req.sessionId]}


@api_router.get("/recordings/state")
async def get_recording_state(sessionId: str):
    return {"sessionId": sessionId, "recording": bool(_record_state.get(sessionId, False))}


# --- Optional: LiveKit Egress composite recording stubs ---
@api_router.post("/egress/start")
async def egress_start(sessionId: str):
    if not sessionId:
        raise HTTPException(status_code=400, detail="sessionId required")
    try:
        resp = requests.post(f"{EGRESS_SERVICE_URL}/start", json={"sessionId": sessionId}, timeout=15)
        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        return resp.json()
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"egress service error: {e}")


@api_router.post("/egress/stop")
async def egress_stop(egressId: str):
    if not egressId:
        raise HTTPException(status_code=400, detail="egressId required")
    try:
        resp = requests.post(f"{EGRESS_SERVICE_URL}/stop", json={"egressId": egressId}, timeout=15)
        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        return resp.json()
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"egress service error: {e}")

def generate_otp() -> str:
    return ''.join(random.choices(string.digits, k=6))

def create_jwt_token(user_id: str, email: str, role: str, company_id: str = None) -> str:
    payload = {
        "user_id": user_id, 
        "email": email, 
        "role": role,
        "company_id": company_id,
        "exp": datetime.now(timezone.utc).timestamp() + 86400
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def get_current_recruiter(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        if payload.get("role") != "recruiter":
            raise HTTPException(status_code=403, detail="Access denied")
        recruiter = await db.recruiters.find_one({"id": payload["user_id"]})
        if recruiter:
            return Recruiter(**recruiter)
        raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_candidate(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        if payload.get("role") != "candidate":
            raise HTTPException(status_code=403, detail="Access denied")
        candidate = await db.candidates.find_one({"id": payload["user_id"]})
        if candidate:
            return CandidateUser(**candidate)
        raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def extract_text_from_pdf(file_content: bytes) -> str:
    """Extract text content from PDF resume"""
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        logging.error(f"PDF parsing error: {e}")
        return ""

def parse_resume_skills(resume_text: str) -> List[str]:
    """Extract skills from resume text using simple keyword matching"""
    common_skills = [
        "Python", "JavaScript", "Java", "React", "Node.js", "SQL", "MongoDB", 
        "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Machine Learning", 
        "Data Science", "HTML", "CSS", "TypeScript", "Angular", "Vue.js",
        "FastAPI", "Django", "Flask", "PostgreSQL", "Redis", "Git", "Linux",
        "Project Management", "Agile", "Scrum", "Leadership", "Communication"
    ]
    
    found_skills = []
    resume_lower = resume_text.lower()
    
    for skill in common_skills:
        if skill.lower() in resume_lower:
            found_skills.append(skill)
    
    return found_skills

# Recruiter Authentication Routes
@api_router.post("/recruiters/auth/register")
async def register_recruiter(recruiter_data: RecruiterRegister):
    # Check if recruiter exists
    existing_recruiter = await db.recruiters.find_one({"email": recruiter_data.email})
    if existing_recruiter:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create company
    company = Company(
        name=recruiter_data.company_name,
        domain=recruiter_data.company_domain,
        size=recruiter_data.company_size,
        industry=recruiter_data.industry
    )
    await db.companies.insert_one(company.dict())
    
    # Create recruiter
    recruiter_dict = recruiter_data.dict()
    hashed_password = hash_password(recruiter_dict.pop("password"))
    
    # Remove company fields from recruiter data
    for field in ["company_name", "company_domain", "company_size", "industry"]:
        recruiter_dict.pop(field, None)
    
    recruiter = Recruiter(company_id=company.id, **recruiter_dict)
    
    # Store recruiter and password
    await db.recruiters.insert_one(recruiter.dict())
    await db.user_passwords.insert_one({"user_id": recruiter.id, "password": hashed_password, "role": "recruiter"})
    
    token = create_jwt_token(recruiter.id, recruiter.email, "recruiter", company.id)
    return {"user": recruiter, "company": company, "token": token, "role": "recruiter", "message": "Registration successful"}

@api_router.post("/recruiters/auth/login")
async def login_recruiter(login_data: RecruiterLogin):
    # Find recruiter
    recruiter = await db.recruiters.find_one({"email": login_data.email})
    if not recruiter:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    user_password = await db.user_passwords.find_one({"user_id": recruiter["id"], "role": "recruiter"})
    if not user_password or not verify_password(login_data.password, user_password["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Get company info
    company = await db.companies.find_one({"id": recruiter["company_id"]})
    
    token = create_jwt_token(recruiter["id"], recruiter["email"], "recruiter", recruiter["company_id"])
    return {
        "user": Recruiter(**recruiter), 
        "company": Company(**company) if company else None,
        "token": token, 
        "role": "recruiter",
        "message": "Login successful"
    }

# Candidate Authentication Routes
@api_router.post("/candidates/auth/register")
async def register_candidate(candidate_data: CandidateRegister):
    # Check if candidate exists
    existing_candidate = await db.candidates.find_one({"email": candidate_data.email})
    if existing_candidate:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create candidate
    candidate_dict = candidate_data.dict()
    hashed_password = hash_password(candidate_dict.pop("password"))
    
    candidate = CandidateUser(**candidate_dict)
    
    # Store candidate and password
    await db.candidates.insert_one(candidate.dict())
    await db.user_passwords.insert_one({"user_id": candidate.id, "password": hashed_password, "role": "candidate"})
    
    # Generate email verification
    email_code = generate_verification_code()
    email_verification = EmailVerification(
        user_id=candidate.id,
        email=candidate.email,
        verification_code=email_code,
        expires_at=datetime.now(timezone.utc).replace(microsecond=0) + timedelta(hours=24)
    )
    await db.email_verifications.insert_one(email_verification.dict())
    
    # Generate phone verification
    phone_otp = generate_otp()
    phone_verification = PhoneVerification(
        user_id=candidate.id,
        phone=candidate.phone,
        otp_code=phone_otp,
        expires_at=datetime.now(timezone.utc).replace(microsecond=0) + timedelta(minutes=10)
    )
    await db.phone_verifications.insert_one(phone_verification.dict())
    
    # In production, send actual email and SMS
    # For demo, return verification codes
    token = create_jwt_token(candidate.id, candidate.email, "candidate")
    return {
        "user": candidate, 
        "token": token, 
        "role": "candidate",
        "message": "Registration successful",
        "email_verification_code": email_code,  # Remove in production
        "phone_otp": phone_otp,  # Remove in production
        "verification_required": True
    }

@api_router.post("/candidates/auth/login")
async def login_candidate(login_data: CandidateLogin):
    # Find candidate
    candidate = await db.candidates.find_one({"email": login_data.email})
    if not candidate:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    user_password = await db.user_passwords.find_one({"user_id": candidate["id"], "role": "candidate"})
    if not user_password or not verify_password(login_data.password, user_password["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_jwt_token(candidate["id"], candidate["email"], "candidate")
    # Audit: native password login
    await log_login_event("candidate", candidate["id"], method="native-password", email=candidate["email"], success=True)
    return {
        "user": CandidateUser(**candidate), 
        "token": token, 
        "role": "candidate",
        "message": "Login successful"
    }

# Verification Routes
@api_router.post("/candidates/verify-email")
async def verify_email(user_id: str, verification_code: str):
    verification = await db.email_verifications.find_one({
        "user_id": user_id, 
        "verification_code": verification_code,
        "is_verified": False
    })
    
    if not verification:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    # Handle timezone comparison properly
    expires_at = verification["expires_at"]
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Verification code expired")
    
    # Mark as verified
    await db.email_verifications.update_one(
        {"user_id": user_id, "verification_code": verification_code},
        {"$set": {"is_verified": True}}
    )
    await db.candidates.update_one(
        {"id": user_id},
        {"$set": {"is_email_verified": True}}
    )
    
    return {"message": "Email verified successfully"}

@api_router.post("/candidates/verify-phone")
async def verify_phone(user_id: str, otp_code: str):
    verification = await db.phone_verifications.find_one({
        "user_id": user_id, 
        "otp_code": otp_code,
        "is_verified": False
    })
    
    if not verification:
        raise HTTPException(status_code=400, detail="Invalid OTP code")
    
    # Handle timezone comparison properly
    expires_at = verification["expires_at"]
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="OTP code expired")
    
    # Mark as verified
    await db.phone_verifications.update_one(
        {"user_id": user_id, "otp_code": otp_code},
        {"$set": {"is_verified": True}}
    )
    await db.candidates.update_one(
        {"id": user_id},
        {"$set": {"is_phone_verified": True}}
    )
    
    return {"message": "Phone verified successfully"}

@api_router.post("/candidates/resend-email-verification")
async def resend_email_verification(user_id: str):
    candidate = await db.candidates.find_one({"id": user_id})
    if not candidate:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Generate new verification code
    email_code = generate_verification_code()
    email_verification = EmailVerification(
        user_id=user_id,
        email=candidate["email"],
        verification_code=email_code,
        expires_at=datetime.now(timezone.utc).replace(microsecond=0) + timedelta(hours=24)
    )
    
    # Remove old verifications
    await db.email_verifications.delete_many({"user_id": user_id, "is_verified": False})
    await db.email_verifications.insert_one(email_verification.dict())
    
    return {"message": "Verification email sent", "verification_code": email_code}  # Remove code in production

@api_router.post("/candidates/resend-phone-otp")
async def resend_phone_otp(user_id: str):
    candidate = await db.candidates.find_one({"id": user_id})
    if not candidate:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Generate new OTP
    phone_otp = generate_otp()
    phone_verification = PhoneVerification(
        user_id=user_id,
        phone=candidate["phone"],
        otp_code=phone_otp,
        expires_at=datetime.now(timezone.utc).replace(microsecond=0) + timedelta(minutes=10)
    )
    
    # Remove old verifications
    await db.phone_verifications.delete_many({"user_id": user_id, "is_verified": False})
    await db.phone_verifications.insert_one(phone_verification.dict())
    
    return {"message": "OTP sent", "otp_code": phone_otp}  # Remove OTP in production

# Candidate Registration and Authentication
@api_router.post("/candidates/register")
async def register_candidate(candidate_data: CandidateRegister):
    # Check if candidate already exists
    existing_candidate = await db.candidates.find_one({"email": candidate_data.email})
    if existing_candidate:
        raise HTTPException(status_code=400, detail="Candidate already exists")
    
    # Hash password
    password_hash = hashlib.sha256(candidate_data.password.encode()).hexdigest()
    
    # Create candidate
    candidate = CandidateUser(
        email=candidate_data.email,
        full_name=candidate_data.full_name,
        phone=candidate_data.phone,
        location=candidate_data.location,
        current_title=candidate_data.current_title,
        current_company=candidate_data.current_company,
        experience_years=candidate_data.experience_years,
        education=candidate_data.education,
        skills=candidate_data.skills,
        expected_salary=candidate_data.expected_salary,
        linkedin_url=candidate_data.linkedin_url,
        portfolio_url=candidate_data.portfolio_url,
        bio=candidate_data.bio
    )
    
    # Store candidate with password hash
    candidate_dict = candidate.dict()
    candidate_dict["password_hash"] = password_hash
    
    await db.candidates.insert_one(candidate_dict)
    
    # Generate JWT token
    token_data = {
        "user_id": candidate.id,
        "email": candidate.email,
        "role": "candidate",
        "exp": datetime.now(timezone.utc) + timedelta(hours=24)
    }
    token = jwt.encode(token_data, JWT_SECRET, algorithm="HS256")
    
    return {
        "message": "Candidate registered successfully",
        "access_token": token,
        "candidate": candidate
    }

@api_router.post("/candidates/login")
async def login_candidate(login_data: CandidateLogin):
    # Find candidate
    candidate = await db.candidates.find_one({"email": login_data.email})
    if not candidate:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    password_hash = hashlib.sha256(login_data.password.encode()).hexdigest()
    if candidate.get("password_hash") != password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Generate JWT token
    token_data = {
        "user_id": candidate["id"],
        "email": candidate["email"],
        "role": "candidate",
        "exp": datetime.now(timezone.utc) + timedelta(hours=24)
    }
    token = jwt.encode(token_data, JWT_SECRET, algorithm="HS256")
    
    return {
        "message": "Login successful",
        "access_token": token,
        "candidate": CandidateUser(**candidate)
    }

# Candidate Job Routes
@api_router.get("/candidates/jobs")
async def get_available_jobs(
    search: Optional[str] = None,
    location: Optional[str] = None,
    job_type: Optional[str] = None,
    experience_level: Optional[str] = None,
    current_candidate: CandidateUser = Depends(get_current_candidate)
):
    query = {"status": "active"}
    
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"skills": {"$in": [re.compile(search, re.IGNORECASE)]}}
        ]
    
    if location:
        query["location"] = {"$regex": location, "$options": "i"}
    
    if job_type:
        query["job_type"] = job_type
        
    if experience_level:
        query["experience_level"] = experience_level
    
    jobs = await db.jobs.find(query).to_list(1000)
    enriched_jobs = []
    for job_doc in jobs:
        # Sanitize job
        job_payload = {k: v for k, v in dict(job_doc).items() if k != "_id"}

        # Fetch and sanitize company
        company_doc = await db.companies.find_one({"id": job_payload.get("company_id")})
        company_payload = None
        if company_doc:
            company_payload = {k: v for k, v in dict(company_doc).items() if k != "_id"}

        # Check if candidate already applied
        existing_application = await db.candidate_applications.find_one({
            "job_id": job_payload.get("id"),
            "candidate_id": current_candidate.id
        })

        enriched_jobs.append({
            "job": job_payload,
            "company": company_payload,
            "has_applied": bool(existing_application),
            "application_id": existing_application["id"] if existing_application else None
        })
    
    return enriched_jobs


@api_router.post("/candidates/resume")
async def upload_resume(
    file: UploadFile = File(...),
    current_candidate: CandidateUser = Depends(get_current_candidate)
):
    """Upload or replace candidate resume. Stores file to local FS and updates candidate profile."""
    resumes_dir = ROOT_DIR / "resumes" / current_candidate.id
    resumes_dir.mkdir(parents=True, exist_ok=True)
    dest_path = resumes_dir / file.filename

    # Save file
    with dest_path.open("wb") as f:
        content = await file.read()
        f.write(content)

    # Optional: parse basic skills
    try:
        text_preview = content[:5000].decode(errors="ignore") if isinstance(content, (bytes, bytearray)) else ""
        parsed_skills = parse_resume_skills(text_preview)
    except Exception:
        parsed_skills = []

    await db.candidates.update_one(
        {"id": current_candidate.id},
        {"$set": {"resume_path": str(dest_path), "skills": list(set((current_candidate.skills or []) + parsed_skills))}}
    )

    return {"message": "Resume uploaded successfully", "filename": file.filename}


@api_router.get("/candidates/{candidate_id}/resume")
async def get_candidate_resume(
    candidate_id: str,
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Allow a recruiter to download a candidate's resume only if the candidate has applied to the recruiter's company."""
    candidate = await db.candidates.find_one({"id": candidate_id})
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Check at least one application exists linking candidate to this company
    related_application = await db.candidate_applications.find_one({
        "candidate_id": candidate_id,
        "company_id": current_recruiter.company_id
    })
    if not related_application:
        raise HTTPException(status_code=403, detail="Forbidden")

    resume_path = candidate.get("resume_path")
    if not resume_path:
        raise HTTPException(status_code=404, detail="Resume not uploaded")
    path = Path(resume_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Resume file missing on server")

    # Basic content type guess
    media_type = "application/pdf" if path.suffix.lower() == ".pdf" else "application/octet-stream"
    return FileResponse(path, media_type=media_type, filename=path.name)

class ApplicationRequest(BaseModel):
    job_id: str
    cover_letter: str

@api_router.post("/candidates/applications")
async def apply_for_job(
    request: ApplicationRequest,
    current_candidate: CandidateUser = Depends(get_current_candidate)
):
    job_id = request.job_id
    cover_letter = request.cover_letter
    
    # Check if job exists and is active
    job = await db.jobs.find_one({"id": job_id, "status": "active"})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or not available")
    
    # Check if already applied
    existing_application = await db.candidate_applications.find_one({
        "job_id": job_id,
        "candidate_id": current_candidate.id
    })
    if existing_application:
        raise HTTPException(status_code=400, detail="Already applied for this job")
    
    # Create application
    application = CandidateApplication(
        job_id=job_id,
        candidate_id=current_candidate.id,
        company_id=job["company_id"],
        cover_letter=cover_letter
    )
    
    await db.candidate_applications.insert_one(application.dict())
    
    # Automatically schedule interview after successful application
    try:
        # Get the recruiter for this job
        recruiter = await db.recruiters.find_one({"company_id": job["company_id"]})
        
        if recruiter:
            # Create automatic interview scheduling for IMMEDIATE conduct
            interview = Interview(
                application_id=application.id,
                candidate_id=current_candidate.id,
                interviewer_id=recruiter["id"],
                job_id=job_id,
                company_id=job["company_id"],
                interview_type="video",
                scheduled_date=datetime.now(timezone.utc),  # RIGHT NOW!
                duration_minutes=30,  # 30 minutes for immediate testing
                status="scheduled",  # Will be changed to "in_progress" when started
                meeting_link=f"https://meet.google.com/interview-{application.id[:8]}"
            )
            
            await db.interviews.insert_one(interview.dict())
            
            return {
                "message": "Application submitted successfully and interview ready to start NOW!",
                "application": application,
                "interview": {
                    "id": interview.id,
                    "scheduled_date": interview.scheduled_date,
                    "duration_minutes": interview.duration_minutes,
                    "interview_type": interview.interview_type,
                    "meeting_link": interview.meeting_link,
                    "status": interview.status
                },
                "can_start_immediately": True
            }
        else:
            return {
                "message": "Application submitted successfully. Interview will be scheduled by the recruiter.",
                "application": application
            }
    except Exception as e:
        print(f"Error scheduling interview: {e}")
        return {
            "message": "Application submitted successfully. Interview scheduling will be handled by the recruiter.",
            "application": application
        }

@api_router.get("/companies/{company_id}")
async def get_company(company_id: str):
    """Get company details by ID"""
    company = await db.companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company

@api_router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    """Get job details by ID"""
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@api_router.get("/candidates/my-applications")
async def get_my_applications(current_candidate: CandidateUser = Depends(get_current_candidate)):
    applications = await db.candidate_applications.find({"candidate_id": current_candidate.id}).to_list(1000)

    enriched_applications: list[dict] = []
    for app in applications:
        app_payload = {k: v for k, v in dict(app).items() if k != "_id"}
        job = await db.jobs.find_one({"id": app_payload.get("job_id")})
        company = await db.companies.find_one({"id": app_payload.get("company_id")}) if job else None
        interviews = await db.interviews.find({"application_id": app_payload.get("id")}).to_list(100)

        job_payload = {k: v for k, v in dict(job).items() if k != "_id"} if job else None
        company_payload = {k: v for k, v in dict(company).items() if k != "_id"} if company else None
        interviews_payload = [{k: v for k, v in dict(itm).items() if k != "_id"} for itm in interviews]

        enriched_applications.append({
            "application": app_payload,
            "job": job_payload,
            "company": company_payload,
            "interviews": interviews_payload
        })

    return enriched_applications

@api_router.get("/candidates/interviews")
async def get_my_interviews(current_candidate: CandidateUser = Depends(get_current_candidate)):
    interviews = await db.interviews.find({"candidate_id": current_candidate.id}).to_list(1000)

    enriched_interviews: list[dict] = []
    for iv in interviews:
        iv_payload = {k: v for k, v in dict(iv).items() if k != "_id"}
        application = await db.candidate_applications.find_one({"id": iv_payload.get("application_id")})
        job = await db.jobs.find_one({"id": iv_payload.get("job_id")}) if application else None
        company = await db.companies.find_one({"id": iv_payload.get("company_id")}) if job else None

        app_payload = {k: v for k, v in dict(application).items() if k != "_id"} if application else None
        job_payload = {k: v for k, v in dict(job).items() if k != "_id"} if job else None
        company_payload = {k: v for k, v in dict(company).items() if k != "_id"} if company else None

        enriched_interviews.append({
            "interview": iv_payload,
            "application": app_payload,
            "job": job_payload,
            "company": company_payload
        })

    return enriched_interviews

@api_router.get("/interviews/completed")
async def get_completed_interviews(
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Get recently completed interviews for a recruiter"""
    interviews = await db.interviews.find({
        "interviewer_id": current_recruiter.id,
        "status": "completed"
    }).sort("ended_at", -1).to_list(1000)

    # Enrich with candidate, job, application and aptitude results
    enriched_interviews = []
    for interview in interviews:
        candidate = await db.candidates.find_one({"id": interview["candidate_id"]})
        job = await db.jobs.find_one({"id": interview["job_id"]})
        application = await db.candidate_applications.find_one({"id": interview.get("application_id")})

        # Fetch round-wise aptitude results for this interview
        round_results = await db.round_results.find({
            "interview_id": interview["id"],
            "candidate_id": interview["candidate_id"],
        }).sort("round", 1).to_list(10)

        rounds_summary = [
            {
                "round": r.get("round"),
                "correctAnswers": r.get("correctAnswers", 0),
                "wrongAnswers": r.get("wrongAnswers", 0),
                "percentage": r.get("percentage", 0.0),
                "roundStatus": r.get("roundStatus"),
                "warnings": r.get("warnings", 0),
            }
            for r in (round_results or [])
        ]

        # Remove MongoDB internal _id so FastAPI can serialize
        interview = dict(interview)
        interview.pop("_id", None)
        if candidate:
            candidate = dict(candidate)
            candidate.pop("_id", None)
        if job:
            job = dict(job)
            job.pop("_id", None)
        if application:
            application = dict(application)
            application.pop("_id", None)

        enriched_interviews.append({
            "interview": interview,
            "candidate": candidate,
            "job": job,
            "application": application,
            "rounds": rounds_summary,
            "finalStatus": (candidate or {}).get("finalStatus"),
        })

    return enriched_interviews

@api_router.put("/candidates/profile")
async def update_candidate_profile(
    profile_data: Dict[str, Any],
    current_candidate: CandidateUser = Depends(get_current_candidate)
):
    # Remove fields that shouldn't be updated directly
    protected_fields = ["id", "email", "is_email_verified", "is_phone_verified", "created_at"]
    for field in protected_fields:
        profile_data.pop(field, None)
    
    profile_data["last_updated"] = datetime.now(timezone.utc)
    
    await db.candidates.update_one(
        {"id": current_candidate.id},
        {"$set": profile_data}
    )
    
    # Get updated candidate
    updated_candidate = await db.candidates.find_one({"id": current_candidate.id})
    return {"message": "Profile updated successfully", "user": CandidateUser(**updated_candidate)}

# Clerk sync endpoint to provision candidate and mint app JWT
@api_router.post("/candidates/clerk-sync")
async def candidates_clerk_sync(payload: Dict[str, Any]):
    email = (payload.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="email required")
    full_name = (payload.get("full_name") or "Candidate").strip()
    phone = (payload.get("phone") or "").strip()
    clerk_user_id = payload.get("clerk_user_id")

    # Find by email
    existing = await db.candidates.find_one({"email": email})
    if not existing:
        candidate = CandidateUser(
            email=email,
            full_name=full_name or "Candidate",
            phone=phone or "",
            location="",
            current_title="",
            current_company="",
            experience_years=0,
            education="",
            skills=[],
            is_email_verified=False,
        )
        doc = candidate.dict()
        if clerk_user_id:
            doc["clerk_user_id"] = clerk_user_id
        await db.candidates.insert_one(doc)
        candidate_doc = doc
    else:
        update = {
            "full_name": full_name or existing.get("full_name") or "Candidate",
            "phone": phone or existing.get("phone") or "",
            # Do not auto-verify on sync; require OTP verification step
        }
        if clerk_user_id:
            update["clerk_user_id"] = clerk_user_id
        await db.candidates.update_one({"id": existing["id"]}, {"$set": update})
        candidate_doc = await db.candidates.find_one({"id": existing["id"]})

    # Clean and modelize
    candidate_doc = dict(candidate_doc)
    candidate_doc.pop("_id", None)
    candidate_model = CandidateUser(**candidate_doc)

    token = create_jwt_token(candidate_model.id, candidate_model.email, "candidate")
    # Audit: clerk-sync successful provisioning/login
    await log_login_event("candidate", candidate_model.id, method="clerk-sync", email=candidate_model.email, success=True)
    return {"user": candidate_model.dict(), "token": token, "role": "candidate"}

# Candidate Account OTP (email) verification
@api_router.post("/candidates/request-account-otp")
async def request_account_otp(email: str):
    email = (email or "").strip().lower()
    candidate = await db.candidates.find_one({"email": email})
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    if candidate.get("is_email_verified"):
        return {"message": "Already verified"}
    code = generate_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    await db.email_verifications.delete_many({"user_id": candidate["id"], "is_verified": False})
    await db.email_verifications.insert_one({
        "user_id": candidate["id"],
        "email": email,
        "verification_code": code,
        "expires_at": expires_at,
        "is_verified": False,
        "created_at": datetime.now(timezone.utc),
    })
    # In production, send via email. For dev, return code.
    return {"message": "OTP sent", "code": code}

class VerifyAccountOtpRequest(BaseModel):
    email: EmailStr
    code: str

@api_router.post("/candidates/verify-account-otp")
async def verify_account_otp(req: VerifyAccountOtpRequest):
    email = req.email.strip().lower()
    candidate = await db.candidates.find_one({"email": email})
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    doc = await db.email_verifications.find_one({
        "user_id": candidate["id"],
        "email": email,
        "verification_code": req.code,
        "is_verified": False,
    })
    if not doc:
        raise HTTPException(status_code=400, detail="Invalid code")
    exp = doc.get("expires_at")
    if isinstance(exp, datetime) and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > exp:
        raise HTTPException(status_code=400, detail="Code expired")
    await db.email_verifications.update_one({"_id": doc["_id"]}, {"$set": {"is_verified": True}})
    await db.candidates.update_one({"id": candidate["id"]}, {"$set": {"is_email_verified": True}})
    # Mint fresh JWT after verification
    refreshed = await db.candidates.find_one({"id": candidate["id"]})
    refreshed.pop("_id", None)
    model = CandidateUser(**refreshed)
    token = create_jwt_token(model.id, model.email, "candidate")
    # Audit: otp verification completed
    await log_login_event("candidate", model.id, method="otp-verify", email=model.email, success=True)
    return {"message": "Verified", "user": model.dict(), "token": token}

class SetPasswordRequest(BaseModel):
    new_password: str

@api_router.post("/candidates/set-password")
async def set_candidate_password(req: SetPasswordRequest, current_candidate: CandidateUser = Depends(get_current_candidate)):
    pwd = (req.new_password or "").strip()
    if len(pwd) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    hashed = hash_password(pwd)
    await db.user_passwords.update_one(
        {"user_id": current_candidate.id, "role": "candidate"},
        {"$set": {"password": hashed}},
        upsert=True,
    )
    return {"message": "Password set"}

@api_router.get("/candidates/has-password")
async def candidate_has_password(current_candidate: CandidateUser = Depends(get_current_candidate)):
    doc = await db.user_passwords.find_one({"user_id": current_candidate.id, "role": "candidate"})
    return {"hasPassword": bool(doc and doc.get("password"))}

@api_router.get("/jobs", response_model=List[Job])
async def get_company_jobs(current_recruiter: Recruiter = Depends(get_current_recruiter)):
    jobs = await db.jobs.find({"company_id": current_recruiter.company_id}).to_list(1000)
    return [Job(**job) for job in jobs]

@api_router.put("/jobs/{job_id}", response_model=Job)
async def update_job(job_id: str, job_data: Dict[str, Any], current_recruiter: Recruiter = Depends(get_current_recruiter)):
    # Verify job belongs to company
    job = await db.jobs.find_one({"id": job_id, "company_id": current_recruiter.company_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job_data["last_updated"] = datetime.now(timezone.utc)
    await db.jobs.update_one({"id": job_id}, {"$set": job_data})
    
    updated_job = await db.jobs.find_one({"id": job_id})
    return Job(**updated_job)

@api_router.post("/jobs/{job_id}/publish")
async def publish_job(job_id: str, current_recruiter: Recruiter = Depends(get_current_recruiter)):
    # Update job status to active and set posted date
    result = await db.jobs.update_one(
        {"id": job_id, "company_id": current_recruiter.company_id},
        {"$set": {"status": JobStatus.ACTIVE, "posted_date": datetime.now(timezone.utc)}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return {"message": "Job published successfully"}

# Application Management Routes (Recruiter)
@api_router.get("/applications")
async def get_applications(
    job_id: Optional[str] = None,
    stage: Optional[PipelineStage] = None,
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    query = {"company_id": current_recruiter.company_id}
    
    if job_id:
        query["job_id"] = job_id
    if stage:
        query["stage"] = stage
    
    applications = await db.candidate_applications.find(query).to_list(1000)
    
    # Enrich with candidate and job data
    enriched_applications = []
    for app in applications:
        candidate = await db.candidates.find_one({"id": app["candidate_id"]})
        job = await db.jobs.find_one({"id": app["job_id"]})
        
        enriched_applications.append({
            "application": CandidateApplication(**app),
            "candidate": CandidateUser(**candidate) if candidate else None,
            "job": Job(**job) if job else None
        })
    
    return enriched_applications

@api_router.put("/applications/{application_id}/stage")
async def move_application_stage(
    application_id: str,
    stage: PipelineStage,
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    result = await db.candidate_applications.update_one(
        {"id": application_id, "company_id": current_recruiter.company_id},
        {"$set": {"stage": stage, "last_updated": datetime.now(timezone.utc)}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Application not found")
    
    return {"message": "Application stage updated successfully"}


@api_router.get("/candidates")
async def list_candidates(current_recruiter: Recruiter = Depends(get_current_recruiter)):
    """List candidates visible to the recruiter. MVP returns all candidates."""
    candidates = await db.candidates.find({}).to_list(1000)
    result = []
    for c in candidates:
        # Remove MongoDB internal id which is not JSON serializable
        c.pop("_id", None)
        try:
            result.append(CandidateUser(**c).dict())
        except Exception:
            # Fallback: return raw dict minus _id
            result.append(c)
    return result

# Interview Management Routes
@api_router.post("/interviews")
async def schedule_interview(
    application_id: str,
    scheduled_date: datetime,
    interview_type: str = "video",
    duration_minutes: int = 60,
    meeting_link: Optional[str] = None,
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    # Get application details
    application = await db.candidate_applications.find_one({
        "id": application_id,
        "company_id": current_recruiter.company_id
    })
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    interview = Interview(
        application_id=application_id,
        candidate_id=application["candidate_id"],
        interviewer_id=current_recruiter.id,
        job_id=application["job_id"],
        company_id=current_recruiter.company_id,
        interview_type=interview_type,
        scheduled_date=scheduled_date,
        duration_minutes=duration_minutes,
        meeting_link=meeting_link
    )
    
    await db.interviews.insert_one(interview.dict())
    return {"message": "Interview scheduled successfully", "interview": interview}

@api_router.post("/applications/{application_id}/notes", response_model=Note)
async def add_note(
    application_id: str,
    content: str,
    note_type: str = "general",
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    # Verify application exists and belongs to company
    application = await db.candidate_applications.find_one({
        "id": application_id,
        "company_id": current_recruiter.company_id
    })
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    note = Note(
        application_id=application_id,
        recruiter_id=current_recruiter.id,
        content=content,
        type=note_type
    )

    await db.notes.insert_one(note.dict())
    return note

@api_router.get("/applications/{application_id}/notes", response_model=List[Note])
async def get_application_notes(
    application_id: str,
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    # Verify application exists and belongs to company
    application = await db.candidate_applications.find_one({
        "id": application_id,
        "company_id": current_recruiter.company_id
    })
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    notes = await db.notes.find({"application_id": application_id}).to_list(1000)
    return [Note(**note) for note in notes]

# Analytics Dashboard
@api_router.get("/analytics/dashboard")
async def get_analytics_dashboard(current_recruiter: Recruiter = Depends(get_current_recruiter)):
    company_id = current_recruiter.company_id
    
    # Get basic stats
    total_jobs = await db.jobs.count_documents({"company_id": company_id})
    active_jobs = await db.jobs.count_documents({"company_id": company_id, "status": "active"})
    total_candidates = await db.candidates.count_documents({})
    total_applications = await db.candidate_applications.count_documents({"company_id": company_id})
    
    # Pipeline stats
    pipeline_stages = {}
    for stage in PipelineStage:
        count = await db.candidate_applications.count_documents({
            "company_id": company_id, 
            "stage": stage.value
        })
        pipeline_stages[stage.value] = count
    
    # Recent activity (last 30 days)
    from datetime import timedelta
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    
    recent_applications = await db.candidate_applications.count_documents({
        "company_id": company_id,
        "applied_date": {"$gte": thirty_days_ago}
    })
    
    recent_hires = await db.candidate_applications.count_documents({
        "company_id": company_id,
        "stage": "hired",
        "last_updated": {"$gte": thirty_days_ago}
    })

    # Per-interview aptitude performance for this company
    interviews = await db.interviews.find({"company_id": company_id}).to_list(1000)
    interview_summaries = []
    for it in interviews:
        interview_id = it.get("id")
        candidate_id = it.get("candidate_id")
        if not interview_id or not candidate_id:
            continue

        candidate = await db.candidates.find_one({"id": candidate_id})

        # Round-wise results (scores, percentage, status, warnings)
        round_results = await db.round_results.find({
            "interview_id": interview_id,
            "candidate_id": candidate_id,
        }).sort("round", 1).to_list(10)

        # All MCQ answers for this interview
        answers = await db.candidate_answers.find({
            "interview_id": interview_id,
            "candidate_id": candidate_id,
        }).sort("timestamp", 1).to_list(2000)

        def strip_id(doc):
            if not isinstance(doc, dict):
                return doc
            d = dict(doc)
            d.pop("_id", None)
            return d

        rounds_payload = [
            {
                "round": r.get("round"),
                "correctAnswers": r.get("correctAnswers", 0),
                "wrongAnswers": r.get("wrongAnswers", 0),
                "percentage": r.get("percentage", 0.0),
                "roundStatus": r.get("roundStatus"),
                "warnings": r.get("warnings", 0),
                "duration_sec": r.get("duration_sec", 0),
                "updated_at": r.get("updated_at"),
            }
            for r in (round_results or [])
        ]

        warnings_total = sum(int(r.get("warnings", 0) or 0) for r in (round_results or []))

        interview_summaries.append(
            {
                "interview_id": interview_id,
                "candidate_id": candidate_id,
                "candidate_name": candidate.get("full_name") if candidate else None,
                "job_id": it.get("job_id"),
                "status": it.get("status"),
                "finalStatus": (candidate or {}).get("finalStatus"),
                "rounds": rounds_payload,
                "answers": [strip_id(a) for a in (answers or [])],
                "total_warnings": warnings_total,
            }
        )

    return {
        "overview": {
            "total_jobs": total_jobs,
            "active_jobs": active_jobs,
            "total_candidates": total_candidates,
            "total_applications": total_applications,
        },
        "pipeline": pipeline_stages,
        "recent_activity": {
            "applications_30_days": recent_applications,
            "hires_30_days": recent_hires,
        },
        "interviews": interview_summaries,
    }

# Secure Interview Telemetry Endpoints
@api_router.post("/secure-interview/start")
async def start_secure_interview(
    interview_id: str,
    current_candidate: CandidateUser = Depends(get_current_candidate)
):
    """Start a secure interview session for a candidate."""
    # Validate interview belongs to candidate
    interview = await db.interviews.find_one({"id": interview_id, "candidate_id": current_candidate.id})
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Require prior OTP verification for this interview
    otp_doc = await db.interview_otps.find_one({
        "interview_id": interview_id,
        "candidate_id": current_candidate.id,
        "is_verified": True,
    })
    if not otp_doc:
        raise HTTPException(status_code=400, detail="OTP verification required before starting the session")

    session = SecureInterviewSession(
        interview_id=interview_id,
        candidate_id=current_candidate.id,
        recruiter_id=interview.get("interviewer_id"),
        is_active=True,
    )
    await db.secure_sessions.insert_one(session.dict())
    return {"session_id": session.id, "message": "Secure session started"}


@api_router.post("/secure-interview/{session_id}/facial-analysis")
async def post_facial_analysis(
    session_id: str,
    data: Dict[str, Any],
    current_candidate: CandidateUser = Depends(get_current_candidate)
):
    session = await db.secure_sessions.find_one({"id": session_id, "candidate_id": current_candidate.id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    record = FacialAnalysis(
        interview_id=session["interview_id"],
        candidate_id=current_candidate.id,
        eye_movement_score=float(data.get("eye_movement_score", 0.0)),
        head_movement_score=float(data.get("head_movement_score", 0.0)),
        facial_expression_score=float(data.get("facial_expression_score", 0.0)),
        attention_score=float(data.get("attention_score", 0.0)),
        stress_indicators=list(data.get("stress_indicators", [])),
    )
    await db.facial_analyses.insert_one(record.dict())
    return {"message": "Facial analysis recorded"}


@api_router.post("/secure-interview/{session_id}/voice-analysis")
async def post_voice_analysis(
    session_id: str,
    data: Dict[str, Any],
    current_candidate: CandidateUser = Depends(get_current_candidate)
):
    session = await db.secure_sessions.find_one({"id": session_id, "candidate_id": current_candidate.id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    record = VoiceAnalysis(
        interview_id=session["interview_id"],
        candidate_id=current_candidate.id,
        voice_clarity_score=float(data.get("voice_clarity_score", 0.0)),
        speech_pattern_score=float(data.get("speech_pattern_score", 0.0)),
        background_noise_score=float(data.get("background_noise_score", 0.0)),
        voice_authenticity_score=float(data.get("voice_authenticity_score", 0.0)),
        detected_issues=list(data.get("detected_issues", [])),
    )
    await db.voice_analyses.insert_one(record.dict())
    return {"message": "Voice analysis recorded"}


@api_router.post("/secure-interview/{session_id}/screen-analysis")
async def post_screen_analysis(
    session_id: str,
    data: Dict[str, Any],
    current_candidate: CandidateUser = Depends(get_current_candidate)
):
    session = await db.secure_sessions.find_one({"id": session_id, "candidate_id": current_candidate.id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    record = ScreenAnalysis(
        interview_id=session["interview_id"],
        candidate_id=current_candidate.id,
        tab_switching_detected=bool(data.get("tab_switching_detected", False)),
        unauthorized_apps_detected=list(data.get("unauthorized_apps_detected", [])),
        screen_sharing_quality=float(data.get("screen_sharing_quality", 0.0)),
        focus_score=float(data.get("focus_score", 0.0)),
    )
    await db.screen_analyses.insert_one(record.dict())
    return {"message": "Screen analysis recorded"}


@api_router.post("/secure-interview/{session_id}/end")
async def end_secure_interview(
    session_id: str,
    current_candidate: CandidateUser = Depends(get_current_candidate)
):
    session = await db.secure_sessions.find_one({"id": session_id, "candidate_id": current_candidate.id, "is_active": True})
    if not session:
        raise HTTPException(status_code=404, detail="Active session not found")

    # Compute simple overall authenticity score
    interview_id = session["interview_id"]
    last_facial = await db.facial_analyses.find({"interview_id": interview_id}).sort("timestamp", -1).to_list(1)
    last_voice = await db.voice_analyses.find({"interview_id": interview_id}).sort("timestamp", -1).to_list(1)
    last_screen = await db.screen_analyses.find({"interview_id": interview_id}).sort("timestamp", -1).to_list(1)

    facial_score = last_facial[0]["attention_score"] if last_facial else 0.0
    voice_score = last_voice[0]["voice_authenticity_score"] if last_voice else 0.0
    screen_score = last_screen[0]["focus_score"] if last_screen else 0.0
    overall = round((facial_score + voice_score + screen_score) / 3.0, 4)

    await db.secure_sessions.update_one(
        {"id": session_id},
        {"$set": {"is_active": False, "session_end": datetime.now(timezone.utc), "overall_authenticity_score": overall, "ai_decision": ("PASS" if overall >= 0.75 else ("REVIEW_REQUIRED" if overall >= 0.6 else "FAIL"))}}
    )

    return {"message": "Session ended", "overall_authenticity_score": overall}


@api_router.post("/secure-interview/{interview_id}/request-otp")
async def request_interview_otp(
    interview_id: str,
    current_candidate: CandidateUser = Depends(get_current_candidate)
):
    """Generate and send an OTP for interview start (demo returns the code)."""
    interview = await db.interviews.find_one({"id": interview_id, "candidate_id": current_candidate.id})
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    otp_code = generate_otp()
    expires_at = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(minutes=10)
    # Remove existing pending OTPs
    await db.interview_otps.delete_many({
        "interview_id": interview_id,
        "candidate_id": current_candidate.id,
        "is_verified": False,
    })
    await db.interview_otps.insert_one({
        "interview_id": interview_id,
        "candidate_id": current_candidate.id,
        "otp_code": otp_code,
        "expires_at": expires_at,
        "is_verified": False,
        "created_at": datetime.now(timezone.utc),
    })
    # In production, send via email/SMS. For demo, return the code.
    return {"message": "OTP sent", "otp_code": otp_code}


@api_router.post("/secure-interview/{interview_id}/verify-otp")
async def verify_interview_otp(
    interview_id: str,
    otp_code: str,
    current_candidate: CandidateUser = Depends(get_current_candidate)
):
    """Verify the OTP for interview start."""
    doc = await db.interview_otps.find_one({
        "interview_id": interview_id,
        "candidate_id": current_candidate.id,
        "otp_code": otp_code,
        "is_verified": False,
    })
    if not doc:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    expires_at = doc.get("expires_at")
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="OTP expired")

    await db.interview_otps.update_one(
        {"_id": doc["_id"]},
        {"$set": {"is_verified": True}}
    )
    return {"message": "OTP verified"}


# Local Recording Storage Endpoints (development/local fallback)
@api_router.post("/secure-interview/{session_id}/upload")
async def upload_recordings(
    session_id: str,
    webcam: UploadFile | None = File(default=None),
    screen: UploadFile | None = File(default=None),
    audio: UploadFile | None = File(default=None),
    current_candidate: CandidateUser = Depends(get_current_candidate)
):
    """Accepts uploaded recording files and stores them under backend/recordings/ locally."""
    # Validate session belongs to candidate
    # Support both legacy and new collection names due to duplicate route definitions
    session = await db.secure_sessions.find_one({"id": session_id, "candidate_id": current_candidate.id})
    if not session:
        session = await db.secure_interview_sessions.find_one({"id": session_id, "candidate_id": current_candidate.id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    interview_id = session["interview_id"]
    recordings_root = ROOT_DIR / "recordings" / interview_id
    recordings_root.mkdir(parents=True, exist_ok=True)

    saved = []
    async def _save_file(kind: str, f: UploadFile | None):
        if not f:
            return
        suffix = Path(f.filename).suffix or ".webm"
        filename = f"{kind}-{uuid.uuid4().hex}{suffix}"
        target = recordings_root / filename
        content = await f.read()
        with open(target, "wb") as out:
            out.write(content)
        doc = {
            "id": str(uuid.uuid4()),
            "interview_id": interview_id,
            "session_id": session_id,
            "candidate_id": current_candidate.id,
            "kind": kind,
            "path": str(target),
            "size_bytes": len(content),
            "created_at": datetime.now(timezone.utc),
        }
        await db.interview_recordings.insert_one(doc)
        saved.append({"recording_id": doc["id"], "kind": kind, "filename": filename})

    await _save_file("webcam", webcam)
    await _save_file("screen", screen)
    await _save_file("audio", audio)

    return {"message": "Recordings uploaded", "files": saved}


@api_router.get("/secure-interview/{interview_id}/recordings")
async def list_recordings(
    interview_id: str,
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """List recordings for an interview for recruiters of the same company."""
    interview = await db.interviews.find_one({"id": interview_id})
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    # Optional: enforce company match
    if interview.get("company_id") != current_recruiter.company_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    recs = await db.interview_recordings.find({"interview_id": interview_id}).to_list(1000)
    return [
        {
            "id": r.get("id"),
            "kind": r.get("kind"),
            "size_bytes": r.get("size_bytes"),
            "created_at": r.get("created_at"),
        }
        for r in recs
    ]


@api_router.get("/secure-interview/recordings/{recording_id}")
async def get_recording_file(
    recording_id: str,
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Serve a recording file to authorized recruiters."""
    rec = await db.interview_recordings.find_one({"id": recording_id})
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    interview = await db.interviews.find_one({"id": rec["interview_id"]})
    if not interview or interview.get("company_id") != current_recruiter.company_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    path = Path(rec["path"])
    if not path.exists():
        raise HTTPException(status_code=404, detail="File missing on server")
    # Best-effort content type
    media_type = "video/webm" if path.suffix.lower() in [".webm", ".mkv"] else "application/octet-stream"
    return FileResponse(path, media_type=media_type, filename=path.name)


@api_router.get("/secure-interview/{interview_id}/report")
async def get_interview_report(
    interview_id: str,
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Return a simple HTML report summarizing the interview telemetry and recordings."""
    interview = await db.interviews.find_one({"id": interview_id})
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    if interview.get("company_id") != current_recruiter.company_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Session summary (latest session)
    session_docs = await db.secure_sessions.find({"interview_id": interview_id}).sort("session_start", -1).to_list(1)
    session = session_docs[0] if session_docs else None
    if not session:
        session_docs = await db.secure_interview_sessions.find({"interview_id": interview_id}).sort("session_start", -1).to_list(1)
        session = session_docs[0] if session_docs else None
    overall = session.get("overall_authenticity_score") if session else None
    ai_decision = session.get("ai_decision") if session else None

    # Last telemetry snapshots
    last_facial = await db.facial_analyses.find({"interview_id": interview_id}).sort("timestamp", -1).to_list(1)
    last_voice = await db.voice_analyses.find({"interview_id": interview_id}).sort("timestamp", -1).to_list(1)
    last_screen = await db.screen_analyses.find({"interview_id": interview_id}).sort("timestamp", -1).to_list(1)

    # Recordings list
    recs = await db.interview_recordings.find({"interview_id": interview_id}).to_list(100)

    def fmt(val):
        return "-" if val is None else (f"{val:.2f}" if isinstance(val, float) else str(val))

    html = f"""
    <!doctype html>
    <html>
      <head>
        <meta charset='utf-8' />
        <title>SecuHire Interview Report</title>
        <style>
          body {{ font-family: Arial, sans-serif; color: #0f172a; }}
          .section {{ margin: 20px 0; }}
          .title {{ font-size: 20px; font-weight: 700; margin-bottom: 8px; }}
          table {{ border-collapse: collapse; width: 100%; }}
          th, td {{ border: 1px solid #e2e8f0; padding: 8px; text-align: left; }}
          th {{ background: #f8fafc; }}
          .badge {{ display: inline-block; padding: 4px 10px; border-radius: 999px; background: #eef2ff; color: #3730a3; font-size: 12px; }}
        </style>
      </head>
      <body>
        <h1>SecuHire Interview Report</h1>
        <div class='section'>
          <div class='title'>Interview</div>
          <div>ID: {interview_id}</div>
          <div>Type: {interview.get('interview_type','')}</div>
          <div>Scheduled: {interview.get('scheduled_date','')}</div>
        </div>
        <div class='section'>
          <div class='title'>AI Decision</div>
          <div>Overall Authenticity Score: <span class='badge'>{fmt(overall)}</span></div>
          <div>Decision: <span class='badge'>{ai_decision or '-'}</span></div>
        </div>
        <div class='section'>
          <div class='title'>Last Telemetry Snapshot</div>
          <table>
            <thead><tr><th>Type</th><th>Key Metrics</th></tr></thead>
            <tbody>
              <tr>
                <td>Facial</td>
                <td>
                  attention: {fmt((last_facial[0]['attention_score']) if last_facial else None)},
                  eye: {fmt((last_facial[0]['eye_movement_score']) if last_facial else None)},
                  head: {fmt((last_facial[0]['head_movement_score']) if last_facial else None)}
                </td>
              </tr>
              <tr>
                <td>Voice</td>
                <td>
                  authenticity: {fmt((last_voice[0]['voice_authenticity_score']) if last_voice else None)},
                  clarity: {fmt((last_voice[0]['voice_clarity_score']) if last_voice else None)},
                  background: {fmt((last_voice[0]['background_noise_score']) if last_voice else None)}
                </td>
              </tr>
              <tr>
                <td>Screen</td>
                <td>
                  focus: {fmt((last_screen[0]['focus_score']) if last_screen else None)},
                  tab_switching: {fmt((last_screen[0]['tab_switching_detected']) if last_screen else None)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class='section'>
          <div class='title'>Recordings</div>
          <table>
            <thead><tr><th>Kind</th><th>Size (bytes)</th><th>Created</th></tr></thead>
            <tbody>
              {''.join([f"<tr><td>{r.get('kind')}</td><td>{r.get('size_bytes','')}</td><td>{r.get('created_at','')}</td></tr>" for r in recs])}
            </tbody>
          </table>
        </div>
      </body>
    </html>
    """
    return HTMLResponse(content=html, media_type="text/html")


# Seed data for demo
@api_router.post("/seed/data")
async def seed_demo_data(current_recruiter: Recruiter = Depends(get_current_recruiter)):
    company_id = current_recruiter.company_id
    
    # Sample jobs
    sample_jobs = [
        {
            "title": "Senior Full Stack Developer",
            "description": "We're looking for a senior developer to lead our frontend initiatives.",
            "requirements": ["React", "Node.js", "5+ years experience"],
            "location": "San Francisco, CA",
            "job_type": "Full-time",
            "salary_min": 120000,
            "salary_max": 180000,
            "skills": ["React", "Node.js", "JavaScript", "MongoDB"],
            "department": "Engineering",
            "experience_level": "Senior",
            "status": "active"
        },
        {
            "title": "Product Marketing Manager", 
            "description": "Drive product marketing strategy and go-to-market execution.",
            "requirements": ["Marketing experience", "B2B SaaS", "Analytics"],
            "location": "Remote",
            "job_type": "Full-time",
            "salary_min": 90000,
            "salary_max": 130000,
            "skills": ["Marketing", "Analytics", "Strategy"],
            "department": "Marketing",
            "experience_level": "Mid",
            "status": "active"
        }
    ]
    
    # Sample candidates (for demo - in production these would be registered by candidates)
    sample_candidates = [
        {
            "email": "john.developer@email.com",
            "full_name": "John Developer",
            "phone": "+1234567890",
            "location": "San Francisco, CA",
            "current_title": "Senior Frontend Developer",
            "current_company": "TechCorp",
            "experience_years": 6,
            "education": "BS Computer Science",
            "skills": ["React", "JavaScript", "TypeScript", "Node.js"],
            "expected_salary": 150000,
            "bio": "Passionate full-stack developer with 6+ years of experience building scalable web applications.",
            "is_email_verified": True,
            "is_phone_verified": True
        },
        {
            "email": "sarah.manager@email.com",
            "full_name": "Sarah Marketing",
            "phone": "+1987654321", 
            "location": "New York, NY",
            "current_title": "Marketing Manager",
            "current_company": "GrowthCo",
            "experience_years": 4,
            "education": "MBA Marketing",
            "skills": ["Marketing", "Analytics", "Strategy", "B2B"],
            "expected_salary": 110000,
            "bio": "Results-driven marketing professional with expertise in B2B SaaS growth strategies.",
            "is_email_verified": True,
            "is_phone_verified": True
        }
    ]
    
    # Insert sample data
    for job_data in sample_jobs:
        job = Job(
            company_id=company_id,
            recruiter_id=current_recruiter.id,
            posted_date=datetime.now(timezone.utc),
            **job_data
        )
        await db.jobs.insert_one(job.dict())
    
    for candidate_data in sample_candidates:
        candidate = CandidateUser(**candidate_data)
        await db.candidates.insert_one(candidate.dict())
    
    return {"message": "Demo data seeded successfully"}

# Interview Recording and Monitoring Routes
@api_router.post("/interviews/{interview_id}/start-recording")
async def start_interview_recording(
    interview_id: str,
    current_candidate: CandidateUser = Depends(get_current_candidate),
    seb_ok: bool = Depends(require_seb)
):
    # Verify interview exists and belongs to candidate
    interview = await db.interviews.find_one({
        "id": interview_id,
        "candidate_id": current_candidate.id
    })
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    # Create recording record
    recording = InterviewRecording(
        interview_id=interview_id,
        candidate_id=current_candidate.id,
        recruiter_id=interview["interviewer_id"]
    )
    
    await db.interview_recordings.insert_one(recording.dict())
    
    # Update interview status
    await db.interviews.update_one(
        {"id": interview_id},
        {"$set": {"status": "in_progress"}}
    )
    
    return {"message": "Recording started", "recording_id": recording.id}

@api_router.post("/interviews/{interview_id}/upload-recording")
async def upload_interview_recording(
    interview_id: str,
    recording_type: str,  # webcam, screen, audio
    file: UploadFile = File(...),
    current_candidate: CandidateUser = Depends(get_current_candidate),
    seb_ok: bool = Depends(require_seb)
):
    # Verify interview recording exists
    recording = await db.interview_recordings.find_one({
        "interview_id": interview_id,
        "candidate_id": current_candidate.id
    })
    if not recording:
        raise HTTPException(status_code=404, detail="Interview recording not found")
    
    # Create recordings directory if it doesn't exist
    recordings_dir = ROOT_DIR / "recordings" / interview_id
    recordings_dir.mkdir(parents=True, exist_ok=True)
    
    # Save file
    file_extension = file.filename.split('.')[-1] if file.filename else 'webm'
    filename = f"{recording_type}_{int(datetime.now().timestamp())}.{file_extension}"
    file_path = recordings_dir / filename
    
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Update recording record
    file_url = f"/recordings/{interview_id}/{filename}"
    update_data = {f"{recording_type}_recording_url": file_url}
    
    if not recording.get("file_size_mb"):
        update_data["file_size_mb"] = len(content) / (1024 * 1024)  # Convert to MB
    else:
        update_data["file_size_mb"] = recording["file_size_mb"] + len(content) / (1024 * 1024)
    
    await db.interview_recordings.update_one(
        {"interview_id": interview_id, "candidate_id": current_candidate.id},
        {"$set": update_data}
    )
    # Also insert a per-file document to match the listing/streaming schema (kind/path/size_bytes)
    try:
        await db.interview_recordings.insert_one({
            "interview_id": interview_id,
            "candidate_id": current_candidate.id,
            "recruiter_id": recording.get("recruiter_id") if isinstance(recording, dict) else getattr(recording, "recruiter_id", None),
            "kind": recording_type,
            "path": str(file_path),
            "size_bytes": len(content),
            "created_at": datetime.now(timezone.utc),
        })
    except Exception as e:
        logging.warning(f"Failed to insert per-file recording doc: {e}")

    return {"message": f"{recording_type} recording uploaded successfully", "file_url": file_url}

@api_router.post("/interviews/{interview_id}/end-recording")
async def end_interview_recording(
    interview_id: str,
    current_candidate: CandidateUser = Depends(get_current_candidate),
    seb_ok: bool = Depends(require_seb)
):
    # Update recording status
    await db.interview_recordings.update_one(
        {"interview_id": interview_id, "candidate_id": current_candidate.id},
        {"$set": {
            "status": "completed",
            "ended_at": datetime.now(timezone.utc)
        }}
    )
    
    # Update interview status
    await db.interviews.update_one(
        {"id": interview_id},
        {"$set": {"status": "completed"}}
    )
    
    return {"message": "Recording ended and interview completed"}

# Candidate heartbeat: keep-alive during interview to detect quits
@api_router.post("/interviews/{interview_id}/heartbeat")
async def interview_heartbeat(
    interview_id: str,
    current_candidate: CandidateUser = Depends(get_current_candidate),
    seb_ok: bool = Depends(require_seb)
):
    interview = await db.interviews.find_one({
        "id": interview_id,
        "candidate_id": current_candidate.id
    })
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    await db.interviews.update_one(
        {"id": interview_id},
        {"$set": {"last_heartbeat": datetime.now(timezone.utc)}}
    )
    return {"ok": True, "ts": datetime.now(timezone.utc).isoformat()}

@api_router.post("/interviews/{interview_id}/security-violation")
async def log_security_violation(
    interview_id: str,
    violation_data: Dict[str, Any],
    current_candidate: CandidateUser = Depends(get_current_candidate)
):
    # Create security violation record
    violation = SecurityViolation(
        interview_id=interview_id,
        candidate_id=current_candidate.id,
        violation_type=violation_data.get("type", "unknown"),
        description=violation_data.get("description", ""),
        severity=violation_data.get("severity", "warning")
    )
    
    await db.security_violations.insert_one(violation.dict())
    
    # Add to interview recording security log
    await db.interview_recordings.update_one(
        {"interview_id": interview_id, "candidate_id": current_candidate.id},
        {"$push": {"security_log": violation.dict()}}
    )
    
    # Notify recruiters via WebSocket
    await manager.send_to_recruiters(interview_id, {
        "type": "security_violation",
        "violation": violation.dict()
    })
    
    return {"message": "Security violation logged"}

# Recruiter Interview Monitoring Routes
@api_router.get("/interviews/{interview_id}/monitoring")
async def get_interview_monitoring_data(
    interview_id: str,
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    # Verify interview belongs to recruiter's company
    interview = await db.interviews.find_one({
        "id": interview_id,
        "company_id": current_recruiter.company_id
    })
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    # Get recording data
    recording = await db.interview_recordings.find_one({"interview_id": interview_id})
    
    # Get security violations
    violations = await db.security_violations.find({"interview_id": interview_id}).to_list(1000)
    
    # Get candidate info
    candidate = await db.candidates.find_one({"id": interview["candidate_id"]})
    
    return {
        "interview": Interview(**interview),
        "candidate": CandidateUser(**candidate) if candidate else None,
        "recording": InterviewRecording(**recording) if recording else None,
        "security_violations": [SecurityViolation(**v) for v in violations],
        "is_live": recording["status"] == "recording" if recording else False
    }

# ----------------------
# AI Evaluation Endpoints
# ----------------------

def _safe_avg(values: list[float]) -> float:
    vals = [v for v in values if isinstance(v, (int, float))]
    return float(sum(vals) / len(vals)) if vals else 0.0


@api_router.post("/ai/evaluate/{interview_id}", response_model=AIDecision)
async def ai_evaluate_interview(interview_id: str, current_recruiter: Recruiter = Depends(get_current_recruiter)):
    # Ensure interview belongs to recruiter company
    interview = await db.interviews.find_one({"id": interview_id, "company_id": current_recruiter.company_id})
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Fetch submission and telemetry summaries
    submission = await db.submissions.find_one({"interview_id": interview_id})
    violations_count = await db.security_violations.count_documents({"interview_id": interview_id})

    # Basic heuristic scoring
    answers = (submission or {}).get("answers", [])
    ai_scores = (submission or {}).get("ai_scores", {})
    # Answers quality proxy: count and length
    answer_count = len(answers)
    avg_len = _safe_avg([len(str(a.get("answer", ""))) for a in answers])
    answers_score = min(1.0, (answer_count / 5.0) * 0.6 + (avg_len / 400.0) * 0.4)  # 0..1

    facial = float(ai_scores.get("facial") or ai_scores.get("facial_accuracy") or 0)
    voice = float(ai_scores.get("voice") or ai_scores.get("voice_authenticity") or 0)
    screen = float(ai_scores.get("screen") or ai_scores.get("screen_focus") or 0)
    # Normalize if values are 0..1 already else assume 0..1
    facial_n = facial if 0 <= facial <= 1 else max(0.0, min(1.0, facial / 1.0))
    voice_n = voice if 0 <= voice <= 1 else max(0.0, min(1.0, voice / 1.0))
    screen_n = screen if 0 <= screen <= 1 else max(0.0, min(1.0, screen / 1.0))

    penalty = min(0.5, violations_count * 0.05)
    overall = max(0.0, min(1.0, answers_score * 0.5 + facial_n * 0.2 + voice_n * 0.2 + screen_n * 0.1 - penalty))

    if overall >= 0.75 and violations_count <= 2:
        decision_str = "PASS"
    elif overall < 0.45 or violations_count >= 8:
        decision_str = "FAIL"
    else:
        decision_str = "REVIEW_REQUIRED"

    decision = AIDecision(
        decision=decision_str,
        scores={
            "overall": round(overall, 3),
            "answers": round(answers_score, 3),
            "facial": round(facial_n, 3),
            "voice": round(voice_n, 3),
            "screen": round(screen_n, 3),
            "violations": int(violations_count),
        },
        reasons=[
            "Weighted combination of answers, facial, voice, screen focus with violation penalty",
        ],
    )

    # Persist decision (upsert)
    await db.ai_decisions.update_one(
        {"interview_id": interview_id},
        {"$set": {"interview_id": interview_id, "decision": decision.dict()}},
        upsert=True,
    )
    return decision


@api_router.get("/ai/evaluate/{interview_id}", response_model=AIDecision)
async def ai_get_decision(interview_id: str, current_recruiter: Recruiter = Depends(get_current_recruiter)):
    interview = await db.interviews.find_one({"id": interview_id, "company_id": current_recruiter.company_id})
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    doc = await db.ai_decisions.find_one({"interview_id": interview_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Decision not found")
    payload = doc.get("decision") or {}
    # Ensure shape matches AIDecision
    return AIDecision(**payload)


@api_router.post("/ai/evaluate/{interview_id}/override", response_model=AIDecision)
async def ai_override_decision(interview_id: str, data: Dict[str, Any], current_recruiter: Recruiter = Depends(get_current_recruiter)):
    interview = await db.interviews.find_one({"id": interview_id, "company_id": current_recruiter.company_id})
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    new_decision = str(data.get("decision") or "REVIEW_REQUIRED").upper()
    if new_decision not in {"PASS", "FAIL", "REVIEW_REQUIRED"}:
        raise HTTPException(status_code=400, detail="Invalid decision")

    note = data.get("note")
    now_decision = {
        "decision": new_decision,
        "scores": (data.get("scores") or {}),
        "reasons": [r for r in (data.get("reasons") or [])] + ([f"Overridden by recruiter {current_recruiter.id}"] if note is None else [f"Overridden: {note}"]),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.ai_decisions.update_one(
        {"interview_id": interview_id},
        {"$set": {"interview_id": interview_id, "decision": now_decision}},
        upsert=True,
    )
    return AIDecision(**now_decision)

@api_router.get("/interviews/{interview_id}/summary")
async def get_interview_summary(
    interview_id: str,
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Return aggregated analytics (facial, voice, screen) and candidate resume info for recruiter view."""
    # Verify interview belongs to recruiter's company
    interview = await db.interviews.find_one({
        "id": interview_id,
        "company_id": current_recruiter.company_id
    })
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    candidate = await db.candidates.find_one({"id": interview["candidate_id"]})

    # Fetch analyses
    facial = await db.facial_analyses.find({"interview_id": interview_id}).to_list(10000)
    voice = await db.voice_analyses.find({"interview_id": interview_id}).to_list(10000)
    screen = await db.screen_analyses.find({"interview_id": interview_id}).to_list(10000)

    def avg(lst, key):
        vals = [float(x.get(key, 0) or 0) for x in lst if x.get(key) is not None]
        return sum(vals) / len(vals) if vals else None

    facial_summary = {
        "avg_eye_movement": avg(facial, "eye_movement_score"),
        "avg_head_movement": avg(facial, "head_movement_score"),
        "avg_facial_expression": avg(facial, "facial_expression_score"),
        "avg_attention": avg(facial, "attention_score"),
        "records": len(facial),
        "last_timestamp": (facial[-1]["timestamp"].isoformat() if facial else None)
    }

    voice_summary = {
        "avg_voice_clarity": avg(voice, "voice_clarity_score"),
        "avg_speech_pattern": avg(voice, "speech_pattern_score"),
        "avg_background_noise": avg(voice, "background_noise_score"),
        "avg_voice_authenticity": avg(voice, "voice_authenticity_score"),
        "records": len(voice),
        "last_timestamp": (voice[-1]["timestamp"].isoformat() if voice else None)
    }

    # For screen, aggregate booleans and quality/focus scores
    tab_switches = sum(1 for x in screen if bool(x.get("tab_switching_detected")))
    unauthorized_counts = sum(len(x.get("unauthorized_apps_detected", [])) for x in screen)
    screen_summary = {
        "avg_sharing_quality": avg(screen, "screen_sharing_quality"),
        "avg_focus": avg(screen, "focus_score"),
        "tab_switch_events": tab_switches,
        "unauthorized_apps_events": unauthorized_counts,
        "records": len(screen),
        "last_timestamp": (screen[-1]["timestamp"].isoformat() if screen else None)
    }

    # Resume info
    resume_path = (candidate or {}).get("resume_path")
    resume_available = bool(resume_path)
    resume_download_endpoint = f"/api/candidates/{(candidate or {}).get('id')}/resume" if resume_available else None

    return {
        "interview": Interview(**interview),
        "candidate": CandidateUser(**candidate) if candidate else None,
        "facial_summary": facial_summary,
        "voice_summary": voice_summary,
        "screen_summary": screen_summary,
        "resume_available": resume_available,
        "resume_download": resume_download_endpoint
    }

# Candidate answers submission
@api_router.post("/interviews/{interview_id}/submission")
async def submit_interview_answers(
    interview_id: str,
    submission: Dict[str, Any],
    current_candidate: CandidateUser = Depends(get_current_candidate),
    seb_ok: bool = Depends(require_seb)
):
    # Verify interview belongs to candidate
    interview = await db.interviews.find_one({
        "id": interview_id,
        "candidate_id": current_candidate.id
    })
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Normalize submission
    answers = submission.get("answers", [])
    notes = submission.get("notes")
    ai_scores = submission.get("ai_scores")

    doc = CandidateSubmission(
        interview_id=interview_id,
        candidate_id=current_candidate.id,
        answers=answers if isinstance(answers, list) else [],
        notes=notes,
        ai_scores=ai_scores
    ).dict()

    await db.submissions.update_one(
        {"interview_id": interview_id, "candidate_id": current_candidate.id},
        {"$set": doc},
        upsert=True
    )
    return {"message": "Submission saved"}

@api_router.get("/interviews/{interview_id}/submission")
async def get_interview_submission(
    interview_id: str,
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    # Verify interview belongs to recruiter's company
    interview = await db.interviews.find_one({
        "id": interview_id,
        "company_id": current_recruiter.company_id
    })
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    submission = await db.submissions.find_one({"interview_id": interview_id})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    # Hide internal _id
    submission.pop("_id", None)
    return submission

# SEB presence check for frontend gating
@api_router.get("/interviews/{interview_id}/seb-check")
async def seb_check(
    interview_id: str,
    current_candidate: CandidateUser = Depends(get_current_candidate),
    seb_ok: bool = Depends(require_seb)
):
    # If require_seb passes (or is disabled), return ok
    return {"ok": True, "seb_required": SEB_REQUIRED}

# WebSocket endpoint for real-time interview monitoring
@api_router.websocket("/interviews/{interview_id}/ws/{user_type}")
async def interview_websocket(websocket: WebSocket, interview_id: str, user_type: str):
    await manager.connect(websocket, interview_id, user_type)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if user_type == "candidate":
                # Forward candidate data to recruiters
                await manager.send_to_recruiters(interview_id, {
                    "type": message.get("type", "candidate_data"),
                    "data": message
                })
            elif user_type == "recruiter":
                # Forward recruiter commands to candidate
                await manager.send_to_candidate(interview_id, message)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, interview_id)

# File serving endpoint for recordings
@api_router.get("/recordings/{interview_id}/{filename}")
async def serve_recording(interview_id: str, filename: str):
    file_path = ROOT_DIR / "recordings" / interview_id / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Recording not found")
    
    return {"file_path": str(file_path), "message": "File exists"}  # In production, return actual file

# AI Monitoring and Secure Interview Endpoints
@api_router.post("/secure-interview/start")
async def start_secure_interview(
    interview_id: str,
    current_candidate: CandidateUser = Depends(get_current_candidate)
):
    """Start a secure interview session with AI monitoring"""
    # Verify interview exists and belongs to candidate
    interview = await db.interviews.find_one({
        "id": interview_id,
        "candidate_id": current_candidate.id
    })
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    # Create secure session
    secure_session = SecureInterviewSession(
        interview_id=interview_id,
        candidate_id=current_candidate.id,
        recruiter_id=interview["interviewer_id"]
    )
    
    await db.secure_interview_sessions.insert_one(secure_session.dict())
    
    # Update interview status
    await db.interviews.update_one(
        {"id": interview_id},
        {"$set": {"status": "in_progress"}}
    )
    
    return {
        "message": "Secure interview session started",
        "session_id": secure_session.id,
        "features": {
            "tab_locking": True,
            "screen_sharing": True,
            "webcam_monitoring": True,
            "ai_analysis": True
        }
    }

@api_router.post("/secure-interview/{session_id}/facial-analysis")
async def submit_facial_analysis(
    session_id: str,
    analysis_data: Dict[str, Any],
    current_candidate: CandidateUser = Depends(get_current_candidate)
):
    """Submit facial analysis data for AI processing"""
    # Verify session exists
    session = await db.secure_interview_sessions.find_one({
        "id": session_id,
        "candidate_id": current_candidate.id,
        "is_active": True
    })
    if not session:
        raise HTTPException(status_code=404, detail="Active session not found")
    
    # Create facial analysis record
    facial_analysis = FacialAnalysis(
        interview_id=session["interview_id"],
        candidate_id=current_candidate.id,
        eye_movement_score=analysis_data.get("eye_movement_score", 0.0),
        head_movement_score=analysis_data.get("head_movement_score", 0.0),
        facial_expression_score=analysis_data.get("facial_expression_score", 0.0),
        attention_score=analysis_data.get("attention_score", 0.0),
        stress_indicators=analysis_data.get("stress_indicators", [])
    )
    
    await db.facial_analyses.insert_one(facial_analysis.dict())
    
    # Notify recruiters via WebSocket
    await manager.send_to_recruiters(session["interview_id"], {
        "type": "facial_analysis",
        "data": facial_analysis.dict()
    })
    
    return {"message": "Facial analysis submitted successfully"}

@api_router.post("/secure-interview/{session_id}/voice-analysis")
async def submit_voice_analysis(
    session_id: str,
    analysis_data: Dict[str, Any],
    current_candidate: CandidateUser = Depends(get_current_candidate)
):
    """Submit voice analysis data for AI processing"""
    # Verify session exists
    session = await db.secure_interview_sessions.find_one({
        "id": session_id,
        "candidate_id": current_candidate.id,
        "is_active": True
    })
    if not session:
        raise HTTPException(status_code=404, detail="Active session not found")
    
    # Create voice analysis record
    voice_analysis = VoiceAnalysis(
        interview_id=session["interview_id"],
        candidate_id=current_candidate.id,
        voice_clarity_score=analysis_data.get("voice_clarity_score", 0.0),
        speech_pattern_score=analysis_data.get("speech_pattern_score", 0.0),
        background_noise_score=analysis_data.get("background_noise_score", 0.0),
        voice_authenticity_score=analysis_data.get("voice_authenticity_score", 0.0),
        detected_issues=analysis_data.get("detected_issues", [])
    )
    
    await db.voice_analyses.insert_one(voice_analysis.dict())
    
    # Notify recruiters via WebSocket
    await manager.send_to_recruiters(session["interview_id"], {
        "type": "voice_analysis",
        "data": voice_analysis.dict()
    })
    
    return {"message": "Voice analysis submitted successfully"}

@api_router.post("/secure-interview/{session_id}/screen-analysis")
async def submit_screen_analysis(
    session_id: str,
    analysis_data: Dict[str, Any],
    current_candidate: CandidateUser = Depends(get_current_candidate)
):
    """Submit screen analysis data for AI processing"""
    # Verify session exists
    session = await db.secure_interview_sessions.find_one({
        "id": session_id,
        "candidate_id": current_candidate.id,
        "is_active": True
    })
    if not session:
        raise HTTPException(status_code=404, detail="Active session not found")
    
    # Create screen analysis record
    screen_analysis = ScreenAnalysis(
        interview_id=session["interview_id"],
        candidate_id=current_candidate.id,
        tab_switching_detected=analysis_data.get("tab_switching_detected", False),
        unauthorized_apps_detected=analysis_data.get("unauthorized_apps_detected", []),
        screen_sharing_quality=analysis_data.get("screen_sharing_quality", 0.0),
        focus_score=analysis_data.get("focus_score", 0.0)
    )
    
    await db.screen_analyses.insert_one(screen_analysis.dict())
    
    # Notify recruiters via WebSocket
    await manager.send_to_recruiters(session["interview_id"], {
        "type": "screen_analysis",
        "data": screen_analysis.dict()
    })
    
    return {"message": "Screen analysis submitted successfully"}

@api_router.post("/secure-interview/{session_id}/ai-decision")
async def get_ai_decision(
    session_id: str,
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Get AI decision on candidate authenticity"""
    # Verify session exists and belongs to recruiter
    session = await db.secure_interview_sessions.find_one({
        "id": session_id,
        "recruiter_id": current_recruiter.id
    })
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get all analysis data
    facial_analyses = await db.facial_analyses.find({
        "interview_id": session["interview_id"]
    }).to_list(1000)
    
    voice_analyses = await db.voice_analyses.find({
        "interview_id": session["interview_id"]
    }).to_list(1000)
    
    screen_analyses = await db.screen_analyses.find({
        "interview_id": session["interview_id"]
    }).to_list(1000)
    
    # Calculate overall authenticity score
    total_score = 0.0
    count = 0
    
    for analysis in facial_analyses:
        total_score += analysis["attention_score"] * 0.3
        total_score += analysis["facial_expression_score"] * 0.2
        count += 1
    
    for analysis in voice_analyses:
        total_score += analysis["voice_authenticity_score"] * 0.3
        count += 1
    
    for analysis in screen_analyses:
        if not analysis["tab_switching_detected"]:
            total_score += analysis["focus_score"] * 0.2
        count += 1
    
    overall_score = total_score / max(count, 1)
    
    # Make AI decision
    if overall_score >= 0.8:
        ai_decision = "PASS"
    elif overall_score >= 0.6:
        ai_decision = "REVIEW_REQUIRED"
    else:
        ai_decision = "FAIL"
    
    # Update session with AI decision
    await db.secure_interview_sessions.update_one(
        {"id": session_id},
        {"$set": {
            "overall_authenticity_score": overall_score,
            "ai_decision": ai_decision
        }}
    )
    
    return {
        "overall_authenticity_score": overall_score,
        "ai_decision": ai_decision,
        "confidence": "high" if overall_score >= 0.8 or overall_score <= 0.4 else "medium",
        "recommendations": [
            "Candidate shows good engagement" if overall_score >= 0.7 else "Review candidate behavior",
            "Screen sharing quality is acceptable" if any(a.get("screen_sharing_quality", 0) >= 0.7 for a in screen_analyses) else "Screen sharing quality needs improvement"
        ]
    }

@api_router.post("/secure-interview/{session_id}/end")
async def end_secure_interview(
    session_id: str,
    current_candidate: CandidateUser = Depends(get_current_candidate)
):
    """End secure interview session"""
    # Update session
    await db.secure_interview_sessions.update_one(
        {"id": session_id, "candidate_id": current_candidate.id},
        {"$set": {
            "is_active": False,
            "session_end": datetime.now(timezone.utc)
        }}
    )
    
    # Update interview status
    session = await db.secure_interview_sessions.find_one({"id": session_id})
    if session:
        await db.interviews.update_one(
            {"id": session["interview_id"]},
            {"$set": {"status": "completed"}}
        )
    
    return {"message": "Secure interview session ended"}

@api_router.get("/secure-interview/active-sessions")
async def get_active_sessions(
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Get all active secure interview sessions for the recruiter"""
    sessions = await db.secure_interview_sessions.find({
        "recruiter_id": current_recruiter.id,
        "is_active": True
    }).to_list(1000)
    
    return sessions

@api_router.get("/analytics/ai-monitoring")
async def get_ai_monitoring_data(
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Get AI monitoring analytics data"""
    # Get recent analysis data
    facial_analyses = await db.facial_analyses.find({
        "interview_id": {"$in": await get_recruiter_interview_ids(current_recruiter.id)}
    }).to_list(1000)
    
    voice_analyses = await db.voice_analyses.find({
        "interview_id": {"$in": await get_recruiter_interview_ids(current_recruiter.id)}
    }).to_list(1000)
    
    screen_analyses = await db.screen_analyses.find({
        "interview_id": {"$in": await get_recruiter_interview_ids(current_recruiter.id)}
    }).to_list(1000)
    
    violations = await db.security_violations.find({
        "interview_id": {"$in": await get_recruiter_interview_ids(current_recruiter.id)}
    }).to_list(1000)
    
    # Calculate averages
    facial_avg = sum(a.get("attention_score", 0) for a in facial_analyses) / max(len(facial_analyses), 1) * 100
    voice_avg = sum(a.get("voice_authenticity_score", 0) for a in voice_analyses) / max(len(voice_analyses), 1) * 100
    screen_avg = sum(a.get("focus_score", 0) for a in screen_analyses) / max(len(screen_analyses), 1) * 100
    
    return {
        "facial_accuracy": round(facial_avg, 1),
        "voice_authenticity": round(voice_avg, 1),
        "screen_focus": round(screen_avg, 1),
        "violations_count": len(violations),
        "violations": violations[-10:]  # Last 10 violations
    }

async def get_recruiter_interview_ids(recruiter_id: str):
    """Helper function to get interview IDs for a recruiter"""
    interviews = await db.interviews.find({
        "interviewer_id": recruiter_id
    }).to_list(1000)
    return [interview["id"] for interview in interviews]

# Interview Management Endpoints
@api_router.post("/interviews/schedule")
async def schedule_interview(
    application_id: str,
    scheduled_date: datetime,
    duration_minutes: int = 60,
    interview_type: str = "video",
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Schedule an interview for a specific application"""
    # Get application details
    application = await db.candidate_applications.find_one({"id": application_id})
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Get job details
    job = await db.jobs.find_one({"id": application["job_id"]})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Check if interview already exists
    existing_interview = await db.interviews.find_one({"application_id": application_id})
    if existing_interview:
        raise HTTPException(status_code=400, detail="Interview already scheduled for this application")
    
    # Create interview
    interview = Interview(
        application_id=application_id,
        candidate_id=application["candidate_id"],
        interviewer_id=current_recruiter.id,
        job_id=application["job_id"],
        company_id=application["company_id"],
        interview_type=interview_type,
        scheduled_date=scheduled_date,
        duration_minutes=duration_minutes,
        status="scheduled"
    )
    
    await db.interviews.insert_one(interview.dict())
    
    return {
        "message": "Interview scheduled successfully",
        "interview": interview
    }

@api_router.get("/interviews/upcoming")
async def get_upcoming_interviews(
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Get upcoming interviews for a recruiter"""
    now = datetime.now(timezone.utc)
    interviews = await db.interviews.find({
        "interviewer_id": current_recruiter.id,
        "scheduled_date": {"$gte": now},
        "status": "scheduled"
    }).to_list(1000)
    
    # Enrich with candidate and job data
    enriched_interviews = []
    for interview in interviews:
        candidate = await db.candidates.find_one({"id": interview["candidate_id"]})
        job = await db.jobs.find_one({"id": interview["job_id"]})
        application = await db.candidate_applications.find_one({"id": interview["application_id"]})

        # Remove MongoDB internal _id so FastAPI can serialize
        interview = dict(interview)
        interview.pop("_id", None)
        if candidate:
            candidate = dict(candidate)
            candidate.pop("_id", None)
        if job:
            job = dict(job)
            job.pop("_id", None)
        if application:
            application = dict(application)
            application.pop("_id", None)
        
        enriched_interviews.append({
            "interview": interview,
            "candidate": candidate,
            "job": job,
            "application": application
        })
    
    return enriched_interviews

@api_router.post("/interviews/{interview_id}/reschedule")
async def reschedule_interview(
    interview_id: str,
    new_scheduled_date: datetime,
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Reschedule an existing interview"""
    interview = await db.interviews.find_one({
        "id": interview_id,
        "interviewer_id": current_recruiter.id
    })
    
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    await db.interviews.update_one(
        {"id": interview_id},
        {"$set": {"scheduled_date": new_scheduled_date}}
    )
    
    return {"message": "Interview rescheduled successfully"}

@api_router.post("/interviews/{interview_id}/cancel")
async def cancel_interview(
    interview_id: str,
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    """Cancel an interview"""
    interview = await db.interviews.find_one({
        "id": interview_id,
        "interviewer_id": current_recruiter.id
    })
    
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    await db.interviews.update_one(
        {"id": interview_id},
        {"$set": {"status": "cancelled"}}
    )
    
    return {"message": "Interview cancelled successfully"}

@api_router.post("/interviews/{interview_id}/start")
async def start_interview(
    interview_id: str,
    current_candidate: CandidateUser = Depends(get_current_candidate)
):
    """Start an interview immediately"""
    # Verify interview exists and belongs to candidate
    interview = await db.interviews.find_one({
        "id": interview_id,
        "candidate_id": current_candidate.id
    })
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    # Update interview status to in_progress
    await db.interviews.update_one(
        {"id": interview_id},
        {"$set": {"status": "in_progress", "started_at": datetime.now(timezone.utc)}}
    )
    
    return {
        "message": "Interview started successfully",
        "interview_id": interview_id,
        "status": "in_progress",
        "started_at": datetime.now(timezone.utc).isoformat()
    }

@api_router.post("/interviews/{interview_id}/end")
async def end_interview(
    interview_id: str,
    current_candidate: CandidateUser = Depends(get_current_candidate),
    seb_ok: bool = Depends(require_seb)
):
    """End an interview"""
    # Verify interview exists and belongs to candidate
    interview = await db.interviews.find_one({
        "id": interview_id,
        "candidate_id": current_candidate.id
    })
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    # Update interview status to completed
    await db.interviews.update_one(
        {"id": interview_id},
        {"$set": {"status": "completed", "ended_at": datetime.now(timezone.utc)}}
    )
    
    return {
        "message": "Interview completed successfully",
        "interview_id": interview_id,
        "status": "completed",
        "ended_at": datetime.now(timezone.utc).isoformat()
    }

# Question Sets (CRUD)
@api_router.post("/question-sets", response_model=QuestionSet)
async def create_question_set(
    data: Dict[str, Any],
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    qs = QuestionSet(
        company_id=current_recruiter.company_id,
        name=str(data.get("name")),
        description=data.get("description"),
        questions=[InterviewQuestion(**q) for q in data.get("questions", [])]
    )
    await db.question_sets.insert_one(qs.dict())
    return qs

@api_router.get("/question-sets", response_model=List[QuestionSet])
async def list_question_sets(current_recruiter: Recruiter = Depends(get_current_recruiter)):
    items = await db.question_sets.find({"company_id": current_recruiter.company_id}).to_list(1000)
    return [QuestionSet(**{k: v for k, v in dict(it).items() if k != "_id"}) for it in items]

@api_router.get("/question-sets/{qs_id}", response_model=QuestionSet)
async def get_question_set_detail(qs_id: str, current_recruiter: Recruiter = Depends(get_current_recruiter)):
    qs = await db.question_sets.find_one({"id": qs_id, "company_id": current_recruiter.company_id})
    if not qs:
        raise HTTPException(status_code=404, detail="Question set not found")
    qs.pop("_id", None)
    return QuestionSet(**qs)

@api_router.put("/question-sets/{qs_id}", response_model=QuestionSet)
async def update_question_set(qs_id: str, data: Dict[str, Any], current_recruiter: Recruiter = Depends(get_current_recruiter)):
    qs = await db.question_sets.find_one({"id": qs_id, "company_id": current_recruiter.company_id})
    if not qs:
        raise HTTPException(status_code=404, detail="Question set not found")
    update: Dict[str, Any] = {}
    if "name" in data:
        update["name"] = data["name"]
    if "description" in data:
        update["description"] = data["description"]
    if "questions" in data:
        update["questions"] = [InterviewQuestion(**q).dict() for q in data["questions"]]
    update["updated_at"] = datetime.now(timezone.utc)
    await db.question_sets.update_one({"id": qs_id}, {"$set": update})
    new_doc = await db.question_sets.find_one({"id": qs_id})
    new_doc.pop("_id", None)
    return QuestionSet(**new_doc)

@api_router.delete("/question-sets/{qs_id}")
async def delete_question_set(qs_id: str, current_recruiter: Recruiter = Depends(get_current_recruiter)):
    result = await db.question_sets.delete_one({"id": qs_id, "company_id": current_recruiter.company_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Question set not found")
    return {"message": "Question set deleted"}

# Assign question set to an interview
@api_router.post("/interviews/{interview_id}/assign-question-set")
async def assign_question_set_to_interview(interview_id: str, question_set_id: str, current_recruiter: Recruiter = Depends(get_current_recruiter)):
    interview = await db.interviews.find_one({"id": interview_id, "company_id": current_recruiter.company_id})
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    qs = await db.question_sets.find_one({"id": question_set_id, "company_id": current_recruiter.company_id})
    if not qs:
        raise HTTPException(status_code=404, detail="Question set not found")
    await db.interviews.update_one({"id": interview_id}, {"$set": {"question_set_id": question_set_id}})
    return {"message": "Question set assigned"}

@api_router.get("/interviews/{interview_id}/question-set")
async def get_interview_question_set(interview_id: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    # Allow both candidate and recruiter to read assigned question set if authorized
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    interview = await db.interviews.find_one({"id": interview_id})
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    # Authorization: candidate owner or recruiter of same company
    if payload.get("role") == "candidate":
        if interview.get("candidate_id") != payload.get("user_id"):
            raise HTTPException(status_code=403, detail="Forbidden")
    elif payload.get("role") == "recruiter":
        if interview.get("company_id") != payload.get("company_id"):
            raise HTTPException(status_code=403, detail="Forbidden")
    else:
        raise HTTPException(status_code=403, detail="Forbidden")
    qs_id = interview.get("question_set_id")
    if not qs_id:
        return {"questions": []}
    qs = await db.question_sets.find_one({"id": qs_id})
    if not qs:
        return {"questions": []}
    questions = qs.get("questions", [])
    payload_qs = {k: v for k, v in dict(qs).items() if k != "_id"}
    return {"question_set": payload_qs, "questions": questions}

# Recruiter Evaluations
@api_router.post("/interviews/{interview_id}/evaluations", response_model=RecruiterEvaluation)
async def submit_recruiter_evaluation(
    interview_id: str,
    data: Dict[str, Any],
    current_recruiter: Recruiter = Depends(get_current_recruiter)
):
    interview = await db.interviews.find_one({"id": interview_id, "company_id": current_recruiter.company_id})
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    eval_doc = RecruiterEvaluation(
        interview_id=interview_id,
        recruiter_id=current_recruiter.id,
        rubric_scores=data.get("rubric_scores", {}),
        overall_score=data.get("overall_score"),
        notes=data.get("notes")
    )
    await db.evaluations.insert_one(eval_doc.dict())
    return eval_doc

@api_router.get("/interviews/{interview_id}/evaluations", response_model=List[RecruiterEvaluation])
async def list_recruiter_evaluations(interview_id: str, current_recruiter: Recruiter = Depends(get_current_recruiter)):
    interview = await db.interviews.find_one({"id": interview_id, "company_id": current_recruiter.company_id})
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    items = await db.evaluations.find({"interview_id": interview_id}).to_list(1000)
    return [RecruiterEvaluation(**{k: v for k, v in dict(it).items() if k != "_id"}) for it in items]

# Webhooks for integrations (placeholders)
@api_router.post("/integrations/jobma/webhook")
async def jobma_webhook(payload: Dict[str, Any], authorization: Optional[str] = None):
    secret = os.getenv("JOBMA_WEBHOOK_SECRET")
    # In a real implementation, verify signature from headers; here we just check a query/header equals secret
    if secret and authorization and authorization != secret:
        raise HTTPException(status_code=401, detail="Invalid signature")
    event = {
        "provider": "jobma",
        "payload": payload,
        "received_at": datetime.now(timezone.utc)
    }
    await db.integration_events.insert_one(event)
    # Optionally: update interview/application based on event['type']
    return {"status": "ok"}

@api_router.post("/integrations/recruitcrm/webhook")
async def recruitcrm_webhook(payload: Dict[str, Any], authorization: Optional[str] = None):
    # Similar placeholder verification
    event = {
        "provider": "recruitcrm",
        "payload": payload,
        "received_at": datetime.now(timezone.utc)
    }
    await db.integration_events.insert_one(event)
    return {"status": "ok"}

# ----------------------
# Video Submissions (Firebase URLs)
# ----------------------

@api_router.post("/video-submissions")
async def create_video_submission(payload: Dict[str, Any]):
    # Accept both camelCase and snake_case keys for convenience
    data = {
        "candidate_id": payload.get("candidateId") or payload.get("candidate_id"),
        "candidate_email": payload.get("candidateEmail") or payload.get("candidate_email"),
        "full_name": payload.get("fullName") or payload.get("full_name"),
        "job_id": payload.get("jobId") or payload.get("job_id"),
        "company_id": payload.get("companyId") or payload.get("company_id"),
        "video_url": payload.get("videoUrl") or payload.get("video_url"),
        "size_bytes": payload.get("sizeBytes") or payload.get("size_bytes"),
        "duration_sec": payload.get("durationSec") or payload.get("duration_sec"),
    }
    if not data.get("candidate_id"):
        raise HTTPException(status_code=400, detail="candidateId required")
    if not data.get("video_url"):
        raise HTTPException(status_code=400, detail="videoUrl required")

    doc = VideoSubmission(**data)
    await db.video_submissions.insert_one(doc.dict())
    return {"ok": True, "submission": doc}

@api_router.get("/video-submissions")
async def list_video_submissions(companyId: Optional[str] = None, jobId: Optional[str] = None, candidateId: Optional[str] = None):
    query: Dict[str, Any] = {}
    if companyId:
        query["company_id"] = companyId
    if jobId:
        query["job_id"] = jobId
    if candidateId:
        query["candidate_id"] = candidateId
    items = await db.video_submissions.find(query).sort("created_at", -1).to_list(1000)
    for it in items:
        it.pop("_id", None)
    return {"items": items}

# Include the router in the main app
app.include_router(api_router)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    uvicorn.run("server:app", host="0.0.0.0", port=port)
