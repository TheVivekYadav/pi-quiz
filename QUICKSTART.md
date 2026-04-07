# Quick Start - PI Quiz Platform with Authentication

## What Changed?

✅ **No more hardcoded data** - All quiz/user data now in PostgreSQL  
✅ **Authentication added** - Login with roll number, auto-register new users  
✅ **Database-driven** - Quiz data, enrollments, and results persisted  
✅ **Role-based access** - Admin and user roles supported  
✅ **Enrollment required** - Users must enroll before taking quizzes  

## 30-Second Setup

### 1. Start Backend
```bash
cd hmm
npm install  # First time only
npm run start:dev
```
Server starts at `http://localhost:3000`

### 2. Setup Sample Data
```bash
# In another terminal
bash scripts/setup-admin.sh
```

### 3. Start Frontend
```bash
cd hmmm
npm install  # First time only
npm run start
```
App opens at `http://localhost:8081`

## First Login

1. **Roll Number**: Enter any roll number (e.g., `21BCS001`)
2. **Name** (optional): Your full name
3. **Email** (optional): Your email
4. Click **"Login / Register"**
5. New user account created automatically ✓
6. Redirected to quiz dashboard

## Next Steps

1. **Browse Quizzes** - See available quizzes on home screen
2. **Click Quiz** - View quiz details
3. **Click "Enroll Now"** - Register for the quiz
4. **Take Quiz** - Answer questions
5. **View Results** - See score and leaderboard rank

## Database Setup (If Starting Fresh)

```bash
# Create PostgreSQL database
createdb pi_quiz

# Start backend (auto-creates tables)
cd hmm && npm run start:dev

# Populate sample data
bash scripts/setup-admin.sh
```

## Default Admin Account

- **Roll Number**: `ADMIN001`
- **Email**: `admin@quiz.local`

Login with `ADMIN001` to access admin features (coming soon).

## Key Features Implemented

- ✅ User authentication with auto-registration
- ✅ Database-persisted quizzes and questions
- ✅ Quiz enrollment system
- ✅ Quiz submission and scoring
- ✅ Leaderboard with rankings
- ✅ User progress tracking

## API Authentication

All quiz API requests include authorization header:
```
Authorization: Bearer {token}
```

Handled automatically by frontend after login.

## File Structure

```
Backend (NestJS):
  /hmm/src/
  ├── auth/                    # NEW: Authentication
  │   ├── auth.service.ts
  │   ├── auth.controller.ts
  │   └── users.service.ts
  ├── quiz/                    # UPDATED: Database-driven
  │   ├── quiz.service.ts
  │   └── quiz.controller.ts
  └── database/                # UPDATED: Extended schema
      └── database.service.ts

Frontend (React Native):
  /hmmm/app/
  ├── login.tsx               # NEW: Login screen
  ├── index.tsx               # UPDATED: Auth check
  └── quiz/[id].tsx           # UPDATED: Enrollment

  /hmmm/constants/
  ├── auth-api.ts             # NEW: Auth API calls
  ├── auth-session.ts         # NEW: Token storage
  └── quiz-api.ts             # UPDATED: Auth headers
```

## Troubleshooting

### "Cannot connect to database"
```bash
# Check PostgreSQL is running
psql -U pi_quiz -d pi_quiz

# Check connection string in hmm/src/database/database.service.ts
```

### "Quiz data not showing"
```bash
# Verify quizzes in database
psql -U pi_quiz -d pi_quiz -c "SELECT * FROM quizzes;"

# If empty, run setup
bash scripts/setup-admin.sh
```

### "Login not working"
- Check backend is running: `http://localhost:3000`
- Check browser console for error messages
- Try different roll number

### "Can't access quiz after enrolling"
- Refresh the page
- Check network tab in DevTools
- Verify Authorization header is being sent

## Environment Variables

### Backend (.env or direct)
```
DATABASE_URL=postgresql://pi_quiz:pi_quiz_password@localhost:5432/pi_quiz
DB_POOL_MAX=50
DB_IDLE_TIMEOUT_MS=30000
```

### Frontend (.env.local)
```
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/api
```

## Documentation

Full details in: `AUTHENTICATION_README.md`

This covers:
- Complete database schema
- Authentication flow
- Backend architecture
- Frontend implementation
- API endpoints
- Security considerations

## Next Phase

Future features to implement:
- [ ] Admin panel for quiz creation
- [ ] JWT tokens with expiration
- [ ] Password-based authentication
- [ ] Email verification
- [ ] Quiz scheduling
- [ ] Detailed analytics dashboard
- [ ] Quiz drafts and publishing
- [ ] Question images upload
