# CBD Intake - React PWA

A Progressive Web App for consignment intake management, built with React, TypeScript, and Vite.

## Features

- **Cloud Database**: All data synced across devices via Supabase
- **Authentication**: Secure email/password login with Supabase Auth
- **User Management**: Admin can add/edit/delete users and manage roles
- **Light/Dark Mode**: Toggle between light and dark themes
- **Consigner Management**: Support for new and existing consigners with cloud persistence
- **Three Intake Modes**:
  - **Photo Detection**: Upload photos for YOLO-based item detection
  - **Manual Entry**: Add items one by one with optional photos
  - **Email Import**: Import items from email threads (mock implementation)
- **Dynamic Form Fields**: Configurable fields including name, notes, quantity, price, condition, category, dimensions
- **Multi-Photo Support**: Attach multiple photos to each item
- **E-Signature**: Digital signature capture with initials and date
- **PDF-style Preview**: View intake agreement in document format
- **Records Dashboard**: Search, view, edit, and manage all intake records
- **PWA Support**: Install as app on mobile/desktop

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Supabase** for database and authentication
- **TailwindCSS** for styling (Streamlit-inspired dark theme)
- **Zustand** for state management
- **React Router** for navigation
- **React Signature Canvas** for signature capture
- **Framer Motion** for animations
- **Lucide React** for icons
- **vite-plugin-pwa** for PWA functionality

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- A Supabase account (free tier available)

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Once created, go to **Settings > API** and note your:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **Anon/Public Key**

### 2. Set Up Database Schema

1. In Supabase, go to **SQL Editor**
2. Copy the contents of `supabase/schema.sql`
3. Paste and run in the SQL Editor
4. This creates the necessary tables: `profiles`, `consigners`, `forms`

### 3. Create Your First Admin User

1. In Supabase, go to **Authentication > Users**
2. Click **Add User** > **Create New User**
3. Enter email and password
4. After creation, go to **SQL Editor** and run:
   ```sql
   UPDATE public.profiles 
   SET role = 'admin' 
   WHERE id = 'YOUR_USER_ID';
   ```

### 4. Configure Environment Variables

Create a `.env` file in the `react-intake` directory:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_DETECTION_API_URL=http://localhost:8000
```

### 5. Install and Run

```bash
# Navigate to the project directory
cd react-intake

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The production build will be in the `dist` folder.

## YOLO Object Detection Backend

The app supports real object detection using a Python backend with YOLOv8.

### Setup Detection Backend

```bash
# Navigate to backend directory
cd ../backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the server
python main.py
```

The backend will run at `http://localhost:8000`.

If the detection backend is unavailable, the app will gracefully fall back to adding the uploaded image as a single item.

## Project Structure

```
src/
├── components/
│   ├── modes/           # Intake mode components (Detection, General, Email)
│   ├── steps/           # Intake step components (ConsignerType, ConsignerInfo, ItemEntry)
│   ├── Dashboard.tsx    # Records dashboard
│   ├── FormPreview.tsx  # Agreement preview with signature
│   ├── ItemCard.tsx     # Item display/edit component
│   ├── Layout.tsx       # Main layout with sidebar
│   ├── PhotoCapture.tsx # Photo upload component
│   └── ...
├── db/
│   └── index.ts         # Supabase database operations
├── lib/
│   └── supabase.ts      # Supabase client configuration
├── store/
│   ├── useStore.ts      # Zustand state management
│   └── useAuth.ts       # Authentication state
├── types/
│   ├── index.ts         # TypeScript types
│   └── supabase.ts      # Supabase database types
├── App.tsx
├── main.tsx
└── index.css            # Tailwind + custom styles
```

## Deployment

### Frontend (Vercel)

1. Push your code to GitHub
2. Import the repo in Vercel
3. Set environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_DETECTION_API_URL` (your backend URL)
4. Deploy

### Backend (Railway)

1. Push the `backend/` folder to a GitHub repo
2. Import in Railway
3. Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Deploy

### Supabase Production Setup

1. In Supabase dashboard, go to **Authentication > URL Configuration**
2. Add your production URL to **Site URL** and **Redirect URLs**
3. Go to **Settings > API** and update CORS if needed

## Multi-Device Sync

With Supabase, all data is automatically synced across devices:

- ✅ iPhone, Android, Desktop see the same records
- ✅ Multiple staff members can work simultaneously
- ✅ Data persists even if browser data is cleared
- ✅ Offline support planned (using service workers)

## Features from Original Streamlit App

This PWA replicates the functionality of the original Streamlit intake system:

✅ New/Existing consigner flow  
✅ Consigner search and lookup  
✅ Three intake modes (Detection, Manual, Email)  
✅ Dynamic configurable form fields  
✅ Multiple photos per item  
✅ Accept/Reject item status  
✅ E-signature with initials  
✅ PDF-style preview  
✅ Records dashboard with search  
✅ Form auto-save  
✅ Signed forms become immutable  
✅ Light/Dark mode toggle  
✅ User authentication  
✅ Multi-device sync (NEW with Supabase)  

## Notes

- **Email Import**: Gmail OAuth integration is mocked. For production, implement the actual Gmail API authentication.
- **PDF Generation**: The preview shows a PDF-like view. For actual PDF download, you can integrate `@react-pdf/renderer` or a similar library.

## License

Private - Consigned By Design
