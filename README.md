# Flavrr

A modern restaurant ordering system with owner portal and customer storefront.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Supabase account and project

### Setup

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   
   Create a `.env.local` file in the project root:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   VITE_EDGE_FUNCTION_URL=https://your-project.supabase.co/functions/v1
   ```

   Get these values from your [Supabase Dashboard](https://app.supabase.com) → Project Settings → API

3. **Start the development server:**
   ```bash
   npm run dev
   ```

   The app will open at `http://localhost:3000` (or next available port)

## 🔧 Troubleshooting

### Infinite Loading / Stuck on Spinner

If the app gets stuck loading:

1. **Run a fresh install:**
   ```bash
   npm run fresh
   ```
   This cleans all caches and reinstalls dependencies.

2. **Check environment variables:**
   - Ensure `.env.local` exists in the project root
   - Verify all required variables are set
   - Check for typos in variable names (must start with `VITE_`)

3. **Verify Supabase connection:**
   - Test your Supabase URL in a browser
   - Ensure your anon key is valid
   - Check your network connection

### Port Already in Use

If port 3000 is busy, Vite will automatically try the next available port (3001, 3002, etc.)

### Clear Error Messages

The app now shows a **Setup Required** screen if:
- Environment variables are missing
- Environment variables are invalid
- Supabase connection fails
- Startup checks timeout

This replaces the old infinite loading behavior.

## 📁 Project Structure

```
├── components/          # Reusable UI components
├── contexts/           # React contexts (Auth, etc.)
├── hooks/              # Custom React hooks
├── lib/                # Utilities and configurations
│   ├── env.ts         # Environment validation
│   ├── api.ts         # API client
│   └── supabase.ts    # Supabase client
├── pages/              # Page components
│   └── owner/         # Owner portal pages
├── supabase/
│   ├── functions/     # Edge Functions
│   └── migrations/    # Database migrations
├── App.tsx            # App wrapper with startup checks
├── AppRoutes.tsx      # Route definitions
└── index.tsx          # Entry point
```

## 🛠️ Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run clean` - Remove all build artifacts and caches
- `npm run fresh` - Clean install and start (use when stuck)

## 🔐 Environment Variables

### Required
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

### Optional
- `VITE_EDGE_FUNCTION_URL` - Edge Functions URL (auto-derived if not set)

## 🚨 Common Issues

### "Setup Required" Screen

This means environment validation failed. Check:
1. `.env.local` exists in project root
2. All required variables are present
3. Variable values are valid (URLs are valid, JWT starts with "eyJ")

### Profile Fetch Timeout

If you see "Profile fetch timeout" in console:
1. Check database connection
2. Verify RLS policies are correctly set up
3. Ensure migrations have been applied

### Authentication Loop

If stuck in auth loop:
1. Clear browser local storage
2. Sign out completely
3. Restart the dev server

## 📚 Documentation

- [Supabase Documentation](https://supabase.com/docs)
- [Vite Documentation](https://vitejs.dev)
- [React Router Documentation](https://reactrouter.com)

## 🤝 Support

If you encounter issues:
1. Check the console for error messages
2. Review the "Setup Required" screen for specific missing requirements
3. Try `npm run fresh` to reset everything
4. Check Supabase dashboard for service status
