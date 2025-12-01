# YouTube Clipper Protocol Test

## Manual Testing Links

Click these links to test if the protocol handler is working:

1. **Basic Test:** [obsidian://youtube-clipper?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ](obsidian://youtube-clipper?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ)

2. **With Encoded URL:** [obsidian://youtube-clipper?url=https%3A//www.youtube.com/watch%3Fv%3DdQw4w9WgXcQ](obsidian://youtube-clipper?url=https%3A//www.youtube.com/watch%3Fv%3DdQw4w9WgXcQ)

## Debugging Steps

1. Check Obsidian Developer Console (Ctrl+Shift+I) for these messages:
   - `Setting up obsidian://youtube-clipper protocol handler`
   - `✅ Protocol handler registered successfully`

2. When clicking the test link, look for:
   - `🚀 Protocol handler invoked!`
   - `🔗 URL Handler: handleProtocol called`

3. Test the debug command:
   - Open Command Palette (Ctrl+P)
   - Search for "YouTube Clipper: Test Protocol Handler"

## Chrome Extension Testing

1. Go to any YouTube video
2. Click the red "Clip" button
3. Check Chrome Console (F12) for:
   - `🎯 YouTube Clipper: Starting URL send process`
   - `🚀 YouTube Clipper: Attempting to open Obsidian with URI`

## If Not Working

- Check Obsidian Console for errors during plugin loading
- Verify the plugin is enabled in Community Plugins
- Try restarting Obsidian completely
- Check if protocol handlers are blocked by OS/security settings