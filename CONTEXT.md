# Subtitle Eraser

Web application to remove hard subtitles from videos using AI MediaKit API.

## Language

**Erase Task**:
An asynchronous process submitted to the API to remove subtitles from a video.
_Avoid_: Job, process, subtitle job

**Source Video**:
A publicly accessible HTTP/HTTPS video URL that contains hard subtitles to be erased.
_Avoid_: Input video, original video, video link

**Cleaned Video**:
The processed output MP4 video with subtitles removed.
_Avoid_: Output video, result video, clean video

**Status Polling**:
The client-side or proxy-side process of querying the task status periodically until it completes or fails.
_Avoid_: Querying, checking status, fetching result

**Mock Mode**:
An application state that simulates the subtitle erasing process locally without making actual requests to the Volcengine API.
_Avoid_: Dry run, sandbox, fake mode

## Example Dialogue

**Developer**: When the user drops a file, do we upload it to create a **Source Video**?
**Domain Expert**: Yes, but the third-party API requires a public URL. If we are in **Mock Mode**, we can skip the upload and simulate an **Erase Task** with dummy status updates.
**Developer**: Got it. Once we submit the **Erase Task**, we'll start **Status Polling** until the **Cleaned Video** link is ready or an error occurs.
