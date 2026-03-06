# Resources Folder

This folder contains application resources like logos and images.

## Logo Files

### Current Logo
- **Location**: `public/resources/images/bizom-logo.svg` (or `.png`)
- **Recommended Size**: 150-200px width, 40-60px height
- **Format**: PNG, SVG, or JPG

### How to Replace the Logo

1. **Prepare your logo file**:
   - Name it: `bizom-logo.png` or `bizom-logo.svg`
   - Recommended dimensions: 150-200px wide x 40-60px tall
   - Keep file size under 100KB for best performance

2. **Replace the file**:
   - Delete the existing `bizom-logo.svg` file
   - Copy your logo file to this folder: `public/resources/images/`
   - Name your file: `bizom-logo.png` (or keep as `.svg`)

3. **If using PNG/JPG instead of SVG**:
   - Open `public/index.html`
   - Find line with: `<img src="resources/images/bizom-logo.svg"`
   - Change to: `<img src="resources/images/bizom-logo.png"`

4. **Refresh your browser** - that's it!

### Supported Formats
- ✅ PNG (recommended for photo-realistic logos)
- ✅ SVG (recommended for scalable vector logos)
- ✅ JPG (acceptable but PNG preferred)

### Tips
- Use transparent background PNG for best results
- SVG files scale perfectly on all screen sizes
- Test on both light and dark backgrounds
