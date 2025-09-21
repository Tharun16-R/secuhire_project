import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, File, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from './button'
import { Progress } from './progress'

export const FileUpload = ({ 
  onFilesSelected, 
  accept = {}, 
  maxFiles = 1, 
  maxSize = 10485760, // 10MB
  multiple = false,
  title = "Upload Files",
  description = "Drag and drop files here, or click to browse"
}) => {
  const [uploadProgress, setUploadProgress] = useState({})
  const [uploadedFiles, setUploadedFiles] = useState([])
  
  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      console.error('Rejected files:', rejectedFiles)
    }
    
    const processedFiles = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'pending' // pending, uploading, completed, error
    }))
    
    setUploadedFiles(prev => [...prev, ...processedFiles])
    
    if (onFilesSelected) {
      onFilesSelected(acceptedFiles)
    }
  }, [onFilesSelected])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles,
    maxSize,
    multiple
  })

  const removeFile = (fileId) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId))
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (fileType) => {
    if (fileType.includes('pdf')) return '📄'
    if (fileType.includes('word') || fileType.includes('document')) return '📝'
    if (fileType.includes('image')) return '🖼️'
    return '📎'
  }

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors
          ${isDragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }
        `}
      >
        <input {...getInputProps()} />
        <div className="text-center">
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-500 mb-4">{description}</p>
          <p className="text-sm text-gray-400">
            Maximum file size: {formatFileSize(maxSize)}
            {maxFiles > 1 && ` • Maximum ${maxFiles} files`}
          </p>
        </div>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="font-medium text-gray-900">Uploaded Files</h4>
          {uploadedFiles.map((fileData) => (
            <div key={fileData.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{getFileIcon(fileData.type)}</span>
                <div>
                  <p className="font-medium text-gray-900">{fileData.name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(fileData.size)}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {fileData.status === 'pending' && (
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                )}
                {fileData.status === 'completed' && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
                {fileData.status === 'uploading' && uploadProgress[fileData.id] && (
                  <div className="w-20">
                    <Progress value={uploadProgress[fileData.id]} className="h-2" />
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeFile(fileData.id)
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default FileUpload