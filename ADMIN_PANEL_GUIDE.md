# Admin Panel Development Guide

## Current Status
Admin role is implemented in the database and authentication layer, but the admin UI/endpoints are not yet created.

## What's Already Done ✅

### Backend
- ✅ Admin role defined in users table (role='admin')
- ✅ AuthService can check `isAdmin(token)`
- ✅ QuizController extracts and validates tokens
- ✅ Database schema supports quiz creation

### Frontend
- ✅ Login accepts any roll number
- ✅ Users with admin role can be created
- ✅ Auth session tracks role

### Default Admin
Roll Number: `ADMIN001` → Can be promoted to admin:
```sql
UPDATE users SET role='admin' WHERE roll_number='ADMIN001';
```

---

## Implementation Plan

### Phase 1: Admin Routes & UI (Frontend)

#### 1. Create Admin Tab Layout
**File**: `/hmmm/app/(tabs)/admin.tsx`
```typescript
export default function AdminTab() {
  // Tab with navigation to:
  // - Create Quiz
  // - Manage Quizzes
  // - View Analytics
  // - User Management
}
```

#### 2. Create Quiz Screen
**File**: `/hmmm/app/admin/create-quiz.tsx`
```typescript
// Form fields:
// - Title (text)
// - Topic (text)
// - Category (dropdown)
// - Level (Beginner/Intermediate/Expert)
// - Duration (number)
// - Description (textarea)
// - Expectations (textarea)
// - Curator Note (textarea)
// - Start Date/Time (date picker)
```

#### 3. Questions Editor
**File**: `/hmmm/app/admin/quiz-editor/[quizId]/questions.tsx`
```typescript
// List questions with:
// - Add Question button
// - Edit Question button
// - Delete Question button
// - Reorder Questions (drag/drop)
```

#### 4. Question Form
**File**: `/hmmm/app/admin/quiz-editor/[quizId]/question/[questionId].tsx`
```typescript
// Form fields:
// - Question Text (textarea)
// - Image URL (text input)
// - Option A (text input)
// - Option B (text input)
// - Option C (text input)
// - Option D (text input)
// - Correct Answer (dropdown)
// - Points (number)
```

#### 5. Quiz Management
**File**: `/hmmm/app/admin/quizzes.tsx`
```typescript
// List all quizzes with:
// - Edit button
// - View Results button
// - Delete button
// - Publish/Unpublish toggle
```

---

### Phase 2: Backend Endpoints

#### 1. Quiz CRUD Endpoints
```typescript
// In quiz.controller.ts

@Post('admin/quizzes')
createQuiz(@Body() quizData, @Headers('Authorization') token) {
  // Only allow admins
  // Create quiz with created_by = userId
}

@Put('admin/quizzes/:id')
updateQuiz(@Param('id') quizId, @Body() updates, @Headers('Authorization') token) {
  // Only allow quiz creator or super admin
}

@Delete('admin/quizzes/:id')
deleteQuiz(@Param('id') quizId, @Headers('Authorization') token) {
  // Soft delete to preserve results
}

@Get('admin/quizzes')
listAdminQuizzes(@Headers('Authorization') token) {
  // Show only quizzes created by this admin
}
```

#### 2. Questions CRUD Endpoints
```typescript
@Post('admin/quizzes/:quizId/questions')
createQuestion(@Param('quizId'), @Body() questionData, @Headers('Authorization') token) {
  // Create with auto-incremented question_index
}

@Put('admin/quizzes/:quizId/questions/:questionId')
updateQuestion(@Param('quizId'), @Param('questionId'), @Body() updates, @Headers('Authorization') token) {
  // Update question details
}

@Delete('admin/quizzes/:quizId/questions/:questionId')
deleteQuestion(@Param('quizId'), @Param('questionId'), @Headers('Authorization') token) {
  // Delete and shift indices down
}
```

#### 3. Analytics Endpoints
```typescript
@Get('admin/quizzes/:quizId/analytics')
getQuizAnalytics(@Param('quizId'), @Headers('Authorization') token) {
  // Return:
  // - Total enrollments
  // - Total attempts
  // - Average score
  // - Distribution chart data
  // - Top performers
}

@Get('admin/dashboard')
getDashboard(@Headers('Authorization') token) {
  // Overall statistics
  // Recent quizzes
  // Recent enrollments
}
```

---

### Phase 3: Admin Guards & Authorization

#### 1. Admin Guard Decorator
```typescript
// Create: /hmm/src/guards/admin.guard.ts

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = extractToken(request.headers.authorization);
    return authService.isAdmin(token);
  }
}

// Usage:
@Post('admin/quizzes')
@UseGuards(AdminGuard)
createQuiz() { ... }
```

#### 2. Owner Check Guard
```typescript
// Verify user created the quiz
@UseGuards(OwnerGuard)
@Put('admin/quizzes/:id')
updateQuiz() { ... }
```

---

### Phase 4: Data Validation

#### 1. Create DTO Classes
```typescript
// /hmm/src/quiz/dto/create-quiz.dto.ts

export class CreateQuizDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  topic: string;

  @IsEnum(['Trivia', 'Science', 'History'])
  category: string;

  @IsEnum(['Beginner', 'Intermediate', 'Expert'])
  level: string;

  @IsNumber()
  @Min(5)
  @Max(180)
  durationMinutes: number;

  @IsISO8601()
  startsAt: string;

  // ... more fields
}

// Usage:
@Post('admin/quizzes')
createQuiz(@Body() dto: CreateQuizDto) { ... }
```

#### 2. Question DTO
```typescript
export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  questionText: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  options: { id: string; label: string }[];

  @IsString()
  correctOptionId: string;

  @IsNumber()
  @Min(1)
  @Max(100)
  points: number;
}
```

---

### Phase 5: Advanced Features

#### 1. Quiz Publishing Workflow
```typescript
// Add to quizzes table: status (draft/published/archived)

@Patch('admin/quizzes/:id/publish')
publishQuiz(@Param('id') quizId) {
  // Change status to 'published'
  // Enable enrollments
}

@Patch('admin/quizzes/:id/archive')
archiveQuiz(@Param('id') quizId) {
  // Change status to 'archived'
  // Prevent new enrollments
}
```

#### 2. Question Import/Export
```typescript
@Post('admin/quizzes/:id/import-questions')
importQuestions(@Param('id') quizId, @Body() csvData) {
  // Parse CSV and bulk create questions
}

@Get('admin/quizzes/:id/export-results')
exportResults(@Param('id') quizId) {
  // Export quiz attempts as CSV/Excel
}
```

#### 3. Quiz Scheduling
```typescript
// Add to quizzes table: enrollmentDeadline, resultsVisibleAt

@Patch('admin/quizzes/:id/schedule')
scheduleQuiz(@Param('id') quizId, @Body() { startsAt, endsAt }) {
  // Auto-close enrollments at deadline
  // Auto-release results at visibility date
}
```

---

## Frontend Component Examples

### Create Quiz Form
```typescript
interface FormData {
  title: string;
  topic: string;
  category: string;
  level: string;
  durationMinutes: number;
  startsAt: Date;
  description: string;
  expectations: string;
  curatorNote: string;
}

const [formData, setFormData] = useState<FormData>({
  title: '',
  category: 'Trivia',
  level: 'Beginner',
  durationMinutes: 30,
  // ...
});

const handleSubmit = async () => {
  const response = await fetch('/api/admin/quizzes', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(formData),
  });
};
```

### Questions List Component
```typescript
const QuestionsList = ({ quizId }) => {
  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    // Fetch questions
    fetchQuestions(quizId);
  }, [quizId]);

  return (
    <FlatList
      data={questions}
      renderItem={({ item }) => (
        <QuestionCard
          question={item}
          onEdit={() => navigate(`/admin/question/${item.id}`)}
          onDelete={() => deleteQuestion(item.id)}
        />
      )}
    />
  );
};
```

---

## Database Queries for Admin

### Get Admin's Quizzes
```sql
SELECT * FROM quizzes WHERE created_by = $1 ORDER BY created_at DESC;
```

### Quiz Statistics
```sql
SELECT 
  q.id, 
  q.title,
  COUNT(DISTINCT qe.user_id) as enrollment_count,
  COUNT(DISTINCT qa.id) as attempt_count,
  AVG(qa.score) as average_score,
  MAX(qa.accuracy_rate) as highest_accuracy
FROM quizzes q
LEFT JOIN quiz_enrollments qe ON q.id = qe.quiz_id
LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id
WHERE q.created_by = $1
GROUP BY q.id;
```

### Top Performers
```sql
SELECT 
  u.name,
  u.roll_number,
  qa.score,
  qa.accuracy_rate,
  qa.submitted_at
FROM quiz_attempts qa
JOIN users u ON qa.user_id = u.id
WHERE qa.quiz_id = $1
ORDER BY qa.score DESC
LIMIT 10;
```

---

## Testing Checklist

### Unit Tests
- [ ] Can create quiz as admin
- [ ] Cannot create quiz as regular user
- [ ] Can edit own quiz
- [ ] Cannot edit others' quiz
- [ ] Can delete quiz
- [ ] Question validation works

### Integration Tests
- [ ] Create quiz → shows in admin dashboard
- [ ] Edit question → changes visible in quiz
- [ ] Publish quiz → users can enroll
- [ ] Archive quiz → no new enrollments

### E2E Tests
- [ ] Admin workflow: Create → Questions → Publish → Monitor
- [ ] User can see published quiz
- [ ] Results display to admin

---

## Security Considerations

### 1. Authorization
- Verify `isAdmin()` on all admin endpoints
- Check ownership for edit/delete
- Prevent users from creating quizzes

### 2. Data Validation
- Validate question options (2-4 options)
- Validate correct answer is in options
- Validate points are positive
- Validate timestamps are in future

### 3. Audit Logging
- Log all quiz creations/edits/deletions
- Log who made changes and when
- Keep immutable audit trail

### 4. Rate Limiting
- Limit quiz creation to prevent spam
- Limit bulk imports

---

## Migration Path

1. **Week 1**: Implement Create/Edit Quiz UI
2. **Week 2**: Implement Questions Management
3. **Week 3**: Add Admin Guards & Validation
4. **Week 4**: Analytics Dashboard
5. **Week 5**: Advanced Features (import/export, scheduling)

---

## API Endpoint Summary

```
POST   /api/admin/quizzes              (Create)
GET    /api/admin/quizzes              (List my quizzes)
GET    /api/admin/quizzes/:id          (Get one)
PUT    /api/admin/quizzes/:id          (Update)
DELETE /api/admin/quizzes/:id          (Delete)

POST   /api/admin/quizzes/:id/questions        (Create question)
GET    /api/admin/quizzes/:id/questions        (List questions)
PUT    /api/admin/quizzes/:id/questions/:qid   (Update)
DELETE /api/admin/quizzes/:id/questions/:qid   (Delete)

GET    /api/admin/quizzes/:id/analytics        (Quiz stats)
GET    /api/admin/dashboard                    (Overall stats)
```

---

## Resources

- [NestJS Guards & Decorators](https://docs.nestjs.com/guards)
- [NestJS Class Validators](https://docs.nestjs.com/techniques/validation)
- [React Native Forms](https://reactnative.dev/docs/textinput)
- [Expo File System](https://docs.expo.dev/versions/latest/sdk/filesystem/) (for import/export)

---

## Questions?

Refer to `AUTHENTICATION_README.md` for current architecture and implementation details.
