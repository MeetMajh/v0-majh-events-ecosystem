"use client"

import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile, toBlobURL } from "@ffmpeg/util"

// Singleton FFmpeg instance
let ffmpegInstance: FFmpeg | null = null
let loadPromise: Promise<void> | null = null

export interface VideoProcessingOptions {
  trim?: {
    startTime: number // seconds
    endTime: number // seconds
  }
  crop?: {
    x: number
    y: number
    width: number
    height: number
  }
  resize?: {
    width: number
    height: number
  }
  format?: "mp4" | "webm"
  quality?: "low" | "medium" | "high"
}

export interface ProcessingProgress {
  progress: number // 0-100
  stage: "loading" | "processing" | "finalizing" | "complete"
  message: string
}

/**
 * Get or create FFmpeg instance
 */
export async function getFFmpeg(
  onProgress?: (progress: ProcessingProgress) => void
): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance

  if (loadPromise) {
    await loadPromise
    return ffmpegInstance!
  }

  ffmpegInstance = new FFmpeg()

  // Set up logging
  ffmpegInstance.on("log", ({ message }) => {
    console.log("[FFmpeg]", message)
  })

  // Set up progress tracking
  ffmpegInstance.on("progress", ({ progress }) => {
    onProgress?.({
      progress: Math.round(progress * 100),
      stage: "processing",
      message: `Processing: ${Math.round(progress * 100)}%`,
    })
  })

  loadPromise = (async () => {
    onProgress?.({
      progress: 0,
      stage: "loading",
      message: "Loading video processor...",
    })

    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm"

    await ffmpegInstance!.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    })

    onProgress?.({
      progress: 100,
      stage: "loading",
      message: "Video processor ready",
    })
  })()

  await loadPromise
  return ffmpegInstance
}

/**
 * Process video with FFmpeg
 */
export async function processVideo(
  inputFile: File,
  options: VideoProcessingOptions,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<Blob> {
  const ffmpeg = await getFFmpeg(onProgress)

  const inputName = "input.mp4"
  const outputName = `output.${options.format || "mp4"}`

  onProgress?.({
    progress: 0,
    stage: "processing",
    message: "Preparing video...",
  })

  // Write input file
  await ffmpeg.writeFile(inputName, await fetchFile(inputFile))

  // Build FFmpeg command
  const args: string[] = []

  // Input seeking (if trimming, seek before input for speed)
  if (options.trim) {
    args.push("-ss", options.trim.startTime.toString())
  }

  args.push("-i", inputName)

  // Output duration (if trimming)
  if (options.trim) {
    const duration = options.trim.endTime - options.trim.startTime
    args.push("-t", duration.toString())
  }

  // Video filters
  const filters: string[] = []

  if (options.crop) {
    filters.push(
      `crop=${options.crop.width}:${options.crop.height}:${options.crop.x}:${options.crop.y}`
    )
  }

  if (options.resize) {
    filters.push(`scale=${options.resize.width}:${options.resize.height}`)
  }

  if (filters.length > 0) {
    args.push("-vf", filters.join(","))
  }

  // Quality settings
  const qualityMap = {
    low: { crf: "32", preset: "ultrafast" },
    medium: { crf: "26", preset: "fast" },
    high: { crf: "20", preset: "medium" },
  }
  const quality = qualityMap[options.quality || "medium"]

  if (options.format === "webm") {
    args.push("-c:v", "libvpx-vp9")
    args.push("-crf", quality.crf)
    args.push("-b:v", "0")
    args.push("-c:a", "libopus")
  } else {
    args.push("-c:v", "libx264")
    args.push("-crf", quality.crf)
    args.push("-preset", quality.preset)
    args.push("-c:a", "aac")
    args.push("-movflags", "+faststart")
  }

  args.push("-y", outputName)

  onProgress?.({
    progress: 10,
    stage: "processing",
    message: "Processing video...",
  })

  // Execute FFmpeg
  await ffmpeg.exec(args)

  onProgress?.({
    progress: 90,
    stage: "finalizing",
    message: "Finalizing...",
  })

  // Read output
  const data = await ffmpeg.readFile(outputName)

  // Clean up
  await ffmpeg.deleteFile(inputName)
  await ffmpeg.deleteFile(outputName)

  onProgress?.({
    progress: 100,
    stage: "complete",
    message: "Complete!",
  })

  // Return as blob
  const mimeType = options.format === "webm" ? "video/webm" : "video/mp4"
  return new Blob([data], { type: mimeType })
}

/**
 * Extract thumbnail at specific timestamp
 */
export async function extractThumbnail(
  inputFile: File,
  timestamp: number,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<Blob> {
  const ffmpeg = await getFFmpeg(onProgress)

  const inputName = "input.mp4"
  const outputName = "thumbnail.jpg"

  await ffmpeg.writeFile(inputName, await fetchFile(inputFile))

  await ffmpeg.exec([
    "-ss",
    timestamp.toString(),
    "-i",
    inputName,
    "-vframes",
    "1",
    "-q:v",
    "2",
    "-y",
    outputName,
  ])

  const data = await ffmpeg.readFile(outputName)

  await ffmpeg.deleteFile(inputName)
  await ffmpeg.deleteFile(outputName)

  return new Blob([data], { type: "image/jpeg" })
}

/**
 * Get video metadata
 */
export async function getVideoMetadata(
  inputFile: File
): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve) => {
    const video = document.createElement("video")
    video.preload = "metadata"

    video.onloadedmetadata = () => {
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
      })
      URL.revokeObjectURL(video.src)
    }

    video.src = URL.createObjectURL(inputFile)
  })
}

/**
 * Trim video (convenience function)
 */
export async function trimVideo(
  inputFile: File,
  startTime: number,
  endTime: number,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<Blob> {
  return processVideo(
    inputFile,
    {
      trim: { startTime, endTime },
      quality: "high",
    },
    onProgress
  )
}

/**
 * Crop and resize video for vertical format (9:16)
 */
export async function cropToVertical(
  inputFile: File,
  cropArea: { x: number; y: number; width: number; height: number },
  onProgress?: (progress: ProcessingProgress) => void
): Promise<Blob> {
  return processVideo(
    inputFile,
    {
      crop: cropArea,
      resize: { width: 1080, height: 1920 },
      quality: "high",
    },
    onProgress
  )
}
