# FitFind - Outfit Recommendation Web Application

FitFind is a web application that analyzes outfit photos and helps users find similar clothing items online. Upload a photo of an outfit, and the app will identify individual clothing pieces and search for similar products across various retailers.

## Features

- 🖼️ **Image Analysis**: Upload outfit photos and get AI-powered clothing item identification
- 🔍 **Smart Search**: Automatically search for similar products across multiple retailers
- 💰 **Price Comparison**: View prices, discounts, and ratings from different sources
- 🎯 **Filtering & Sorting**: Filter by price, sale items, and sort by various criteria
- 🔄 **Redo Functionality**: Improve search results with custom feedback
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile devices
- 🛒 **Direct Shopping**: Click through to purchase items from retailers

## Technology Stack

- **Backend**: Flask (Python)
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **AI/ML**: Google Gemini 2.5 Flash for image analysis
- **Search**: SerpAPI for Google Shopping results
- **APIs**: OpenAI (optional), Google GenAI, SerpAPI

## Prerequisites

Before running the application, you'll need:

1. **Python 3.8+** installed on your system
2. **API Keys** for the following services:
   - [Google AI Studio](https://aistudio.google.com/) - for Gemini API
   - [SerpAPI](https://serpapi.com/) - for Google Shopping search
   - [OpenAI](https://openai.com/api/) - (optional, for future features)

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd fitfind
   ```

2. **Create a virtual environment**:
   ```bash
   python -m venv venv
   
   # On Windows:
   venv\Scripts\activate
   
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**:
   Create a `.env` file in the root directory:
   ```env
   # Required API Keys
   GOOGLE_API_KEY=your_google_gemini_api_key_here
   SERPAPI_API_KEY=your_serpapi_key_here
   
   # Optional (for future features)
   OPENAI_API_KEY=your_openai_api_key_here
   ```

## Getting API Keys

### Google Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account
3. Create a new API key
4. Copy the key to your `.env` file

### SerpAPI Key
1. Sign up at [SerpAPI](https://serpapi.com/)
2. Get your free API key (100 searches/month)
3. Copy the key to your `.env` file

## Running the Application

1. **Start the Flask server**:
   ```bash
   python app.py
   ```

2. **Open your browser** and navigate to:
   ```
   http://localhost:5000
   ```

3. **Upload an outfit photo** and start discovering similar clothing items!

## Usage Guide

### Basic Usage

1. **Upload Image**: 
   - Drag and drop an outfit photo onto the upload area
   - Or click "Choose File" to select an image
   - Supported formats: JPEG, PNG, GIF, WebP (max 16MB)

2. **Configure Options**:
   - Select your country for localized shopping results
   - Choose your preferred language

3. **View Results**:
   - The app will identify clothing items in your photo
   - Browse similar products organized by clothing type
   - View prices, ratings, and retailer information

4. **Filter & Sort**:
   - Sort by price, rating, or discount percentage
   - Filter by price range or sale items only
   - Use the price slider to set your budget

5. **Shop**:
   - Click on any product card for detailed information
   - Click "View Product" to go to the retailer's website

### Advanced Features

#### Improve Search Results
If the initial search results aren't quite right:

1. Click the "Improve Search Results" button
2. Provide specific feedback about what you're looking for
3. The AI will generate new search queries based on your feedback
4. View the updated results

#### Product Details
- Click on any product card to open a detailed modal
- View larger images, full descriptions, and all available information
- Direct links to purchase from the original retailer

## API Endpoints

The application provides several API endpoints:

- `POST /api/upload` - Upload and process outfit images
- `POST /api/redo` - Improve search results with feedback
- `GET /api/results/<file_id>` - Retrieve saved results
- `GET /api/health` - Health check endpoint

## File Structure

```
fitfind/
├── app.py                          # Flask web application
├── search_recommendation.py        # Core recommendation engine
├── requirements.txt                # Python dependencies
├── .env                           # Environment variables (create this)
├── templates/
│   └── index.html                 # Main HTML template
├── static/
│   ├── style.css                  # CSS styles
│   └── script.js                  # JavaScript functionality
├── uploads/                       # Uploaded images (auto-created)
├── results/                       # Processing results (auto-created)
└── README.md                      # This file
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_API_KEY` | Yes | Google Gemini API key for image analysis |
| `SERPAPI_API_KEY` | Yes | SerpAPI key for shopping search |
| `OPENAI_API_KEY` | No | OpenAI API key (for future features) |

### Application Settings

You can modify these settings in `app.py`:

- `MAX_CONTENT_LENGTH`: Maximum file upload size (default: 16MB)
- `UPLOAD_FOLDER`: Directory for uploaded images
- `RESULTS_FOLDER`: Directory for processing results

## Troubleshooting

### Common Issues

1. **"No API key" errors**:
   - Ensure your `.env` file is in the root directory
   - Check that API keys are correctly formatted
   - Restart the application after adding keys

2. **Image upload fails**:
   - Check file size (must be < 16MB)
   - Ensure file format is supported (JPEG, PNG, GIF, WebP)
   - Check network connection

3. **No search results**:
   - Try uploading a clearer image with distinct clothing items
   - Use the "Improve Search Results" feature with specific feedback
   - Check that SerpAPI key is valid and has remaining quota

4. **Server errors**:
   - Check the console output for detailed error messages
   - Ensure all dependencies are installed correctly
   - Verify API keys are valid

### Performance Tips

- Use high-quality, well-lit images for best results
- Images with clear, distinct clothing items work better
- Avoid images with too many overlapping or obscured items
- The first search may take 30-60 seconds due to AI processing

## Development

### Running in Development Mode

The application runs in debug mode by default, which provides:
- Automatic reloading when files change
- Detailed error messages
- Debug toolbar (if installed)

### Adding New Features

The codebase is modular and extensible:

- **Backend logic**: Modify `search_recommendation.py`
- **Web interface**: Update `app.py` for new endpoints
- **Frontend**: Edit templates and static files
- **Styling**: Customize `static/style.css`
- **Functionality**: Extend `static/script.js`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues, questions, or feature requests:
1. Check the troubleshooting section above
2. Review existing issues in the repository
3. Create a new issue with detailed information

## Acknowledgments

- Google Gemini for AI-powered image analysis
- SerpAPI for shopping search capabilities
- Flask community for the excellent web framework
- All the retailers and shopping platforms that make this possible 