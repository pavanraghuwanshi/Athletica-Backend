import type { Context } from 'hono'
import { httpStatus } from '../../shared/http/status-codes'
import * as fs from 'node:fs'
import * as path from 'node:path'

export const videoController = {
  streamVideo: async (context: Context) => {
    try {
      const filename = context.req.param('filename')
      if (!filename) {
        return context.json({ message: 'Filename is required' }, httpStatus.badRequest)
      }

      const videoPath = path.join(process.cwd(), 'public', 'videos', 'banners', filename)
      
      // Prevent directory traversal
      if (!videoPath.startsWith(path.join(process.cwd(), 'public', 'videos', 'banners'))) {
        return context.json({ message: 'Forbidden' }, httpStatus.forbidden)
      }

      if (!fs.existsSync(videoPath)) {
        return context.json({ message: 'Video not found' }, httpStatus.notFound)
      }

      const stat = fs.statSync(videoPath)
      const fileSize = stat.size
      const range = context.req.header('range')

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-")
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1

        if (start >= fileSize) {
          context.res.headers.set('Content-Range', `bytes */${fileSize}`)
          context.res.headers.set('Accept-Ranges', 'bytes')
          return context.body(null, 416)
        }

        const chunksize = (end - start) + 1
        const file = Bun.file(videoPath).slice(start, end + 1)
        
        // Ensure proper MIME type is determined
        const ext = path.extname(filename).toLowerCase()
        const mimeType = ext === '.webm' ? 'video/webm' 
                       : ext === '.ogg' ? 'video/ogg' 
                       : ext === '.mov' ? 'video/quicktime'
                       : 'video/mp4'

        context.res.headers.set('Content-Range', `bytes ${start}-${end}/${fileSize}`)
        context.res.headers.set('Accept-Ranges', 'bytes')
        context.res.headers.set('Content-Length', chunksize.toString())
        context.res.headers.set('Content-Type', mimeType)
        
        return context.body(file.stream(), 206)
      } else {
        const ext = path.extname(filename).toLowerCase()
        const mimeType = ext === '.webm' ? 'video/webm' 
                       : ext === '.ogg' ? 'video/ogg' 
                       : ext === '.mov' ? 'video/quicktime'
                       : 'video/mp4'
                       
        context.res.headers.set('Content-Length', fileSize.toString())
        context.res.headers.set('Content-Type', mimeType)
        context.res.headers.set('Accept-Ranges', 'bytes')
        
        return context.body(Bun.file(videoPath).stream(), 200)
      }
    } catch (error) {
      console.error('Error streaming video:', error)
      return context.json({ message: 'Internal server error' }, httpStatus.internalServerError)
    }
  }
}
