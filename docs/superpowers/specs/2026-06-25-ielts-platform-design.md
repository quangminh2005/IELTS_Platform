# IELTS Platform MVP Design

Date: 2026-06-25
Status: Draft for user review

## 1. Goal

Build a web-based IELTS learning platform for teachers and students.

The MVP focuses on the daily teaching loop:

1. Teachers create classes and students.
2. Teachers input IELTS materials.
3. Teachers assign flexible units to individual students.
4. Students complete assigned work on the web.
5. Listening and Reading are auto-graded.
6. Writing and Speaking are reviewed by teachers.
7. Students can review history, feedback, answers, highlights, and rankings.

The visual direction should take inspiration from Chin Platform (`https://www.chin.edu.vn/`): focused exam workspaces, dark/modern test UI, strong timer visibility, split reading/listening layout, keyword highlighting, and clear result analysis. The implementation should not copy the site directly.

## 2. Recommended Approach

Use the Platform Foundation approach for the MVP.

This means building the real teacher/student workflow before advanced mock-test-only features. Exam behavior such as timers, auto-submit, highlighting, and tab-switch logging is included, but the first version is not a full anti-cheat/kiosk system.

## 3. Technology Stack

- Framework: Next.js App Router
- Data access: Prisma
- Development database: SQLite
- Production-ready path: Postgres
- Auth: hybrid demo/product auth
- UI: dashboard-style application, not a landing page

The schema should be designed so SQLite can be replaced with Postgres without rewriting the product model.

## 4. Roles

### Teacher

Teachers can:

- log in with email/password in the MVP;
- create and manage classes;
- add students;
- input IELTS materials;
- assign selected units to individual students;
- review submissions;
- manually score Writing and Speaking;
- view student history, progress, and ranking.

### Student

Students can:

- log in with Google;
- use demo login during local development;
- view assigned work;
- complete homework, practice, and mock-style tasks;
- highlight keywords and add notes while doing Reading/Listening;
- submit work;
- see instant Listening/Reading results;
- wait for teacher feedback on Writing/Speaking;
- review attempt history and ranking.

When a student logs in with Google for the first time, the system checks the email:

- If the email already belongs to a student created by a teacher, link the Google account to that profile.
- If the email is not assigned to any class, show a blocked/waiting state explaining that the teacher must add the student first.

## 5. Core Data Model

### User

Represents an account.

Key fields:

- id
- name
- email
- role: `teacher` or `student`
- password hash for email/password users
- Google provider id for Google login users
- createdAt
- updatedAt

### TeacherProfile

Stores teacher-specific information and owns classes/materials.

Key fields:

- id
- userId
- displayName

### StudentProfile

Stores student-specific information.

Key fields:

- id
- userId
- displayName
- email
- class memberships

### Class

Represents a teacher-managed group.

Key fields:

- id
- teacherId
- name
- description
- createdAt

### ClassStudent

Joins students to classes.

Key fields:

- id
- classId
- studentId
- joinedAt

### Material

A teacher-created IELTS material or test source. This is the container teachers input first.

Examples:

- Cambridge 20 Listening Test 4
- Cambridge 10 Reading Test 2
- Writing Task 2 - Education
- Speaking Part 2 - Describe a person

Key fields:

- id
- teacherId
- skill: `listening`, `reading`, `writing`, `speaking`
- title
- description
- sourceLabel
- createdAt
- updatedAt

### AssignableUnit

A flexible unit inside a material that can be assigned independently or together with other units.

Examples:

- Listening Part 1
- Listening Part 4
- Reading Passage 2
- Writing Task 1 prompt
- Writing Task 2 prompt
- Speaking Part 2 prompt

Key fields:

- id
- materialId
- skill
- unitType: `listening_part`, `reading_passage`, `writing_task`, `speaking_part`
- unitNumber
- title
- instructions
- content
- audioUrl for listening where needed
- transcript
- defaultTimeLimitMinutes
- metadata for writing category, speaking topic, IELTS part, etc.

### Question

Represents a question inside Listening or Reading units.

Key fields:

- id
- assignableUnitId
- order
- questionType
- prompt
- options
- correctAnswer
- explanation
- points

Question types should support common IELTS formats in phases:

- short answer
- multiple choice
- fill in the blank
- matching
- table completion
- true/false/not given
- yes/no/not given

MVP can implement a practical subset first, but the schema should allow additional types.

### Assignment

Represents work assigned by a teacher.

Key fields:

- id
- teacherId
- title
- instructions
- deadline
- timeLimitMinutes
- mode: `homework`, `practice`, or `mock_test`
- createdAt

### AssignmentUnit

Connects selected units to an assignment.

This supports flexible assignment:

- any single Listening part;
- all 4 Listening parts;
- any Reading passage;
- all 3 Reading passages;
- any Writing task/prompt;
- any Speaking part/prompt;
- mixed units if the product later allows combined assignments.

Key fields:

- id
- assignmentId
- assignableUnitId
- order
- customTimeLimitMinutes

### AssignmentRecipient

Connects assignments to individual students.

MVP prioritizes assigning to individual students. Class-wide assignment can be added later by creating recipients for each student in a class.

Key fields:

- id
- assignmentId
- studentId
- status: `assigned`, `in_progress`, `submitted`, `reviewed`

### Attempt

Represents one student attempt on an assignment.

Key fields:

- id
- assignmentRecipientId
- studentId
- startedAt
- submittedAt
- status
- submitReason: `manual`, `auto_timeout`
- elapsedSeconds
- tabSwitchCount
- score
- scorePercent
- autoGradedAt

### Answer

Stores a student's answer for a question or prompt.

Key fields:

- id
- attemptId
- questionId
- assignableUnitId
- value
- isCorrect
- pointsAwarded
- correctAnswerSnapshot
- explanationSnapshot

For Writing, the answer value is the essay text.

For Speaking, the answer value references the uploaded recording metadata.

### Highlight

Stores student keyword highlights and optional notes.

Key fields:

- id
- attemptId
- assignableUnitId
- sourceType: `passage`, `transcript`, `prompt`
- selectedText
- startOffset
- endOffset
- color
- note
- createdAt

Highlights must persist per attempt so students can reopen their work and teachers can see how the student processed the passage/transcript.

### TeacherReview

Stores teacher feedback for Writing and Speaking attempts.

Key fields:

- id
- attemptId
- teacherId
- overallBand
- criteriaScores
- summaryFeedback
- detailedFeedback
- reviewedAt

Criteria can follow IELTS bands:

- Writing Task Achievement or Task Response
- Coherence and Cohesion
- Lexical Resource
- Grammar Range and Accuracy
- Speaking Fluency and Coherence
- Lexical Resource
- Grammar Range and Accuracy
- Pronunciation

## 6. Teacher Workflows

### 6.1 Manage Classes And Students

Teachers can:

- create a class;
- add students by name and email;
- view students in each class;
- open a student profile;
- see assignment status, attempt history, scores, and feedback.

### 6.2 Input Materials

Teachers first create a Material, then create Assignable Units inside it.

Listening input:

- title;
- part number 1-4;
- audio file or audio URL;
- transcript;
- instructions;
- questions;
- correct answers;
- explanations;
- default timer.

Reading input:

- title;
- passage number 1-3;
- passage text;
- instructions;
- questions;
- correct answers;
- explanations;
- default timer.

Writing input:

- task type: Task 1 or Task 2;
- Task 1 category: chart/table, process, map, mixed;
- Task 2 topic: education, health, government, technology, environment, etc.;
- prompt;
- suggested timer;
- optional teacher notes.

Speaking input:

- IELTS part: Part 1, Part 2, or Part 3;
- topic;
- prompt/card;
- preparation time if needed;
- speaking time guidance;
- optional teacher notes.

### 6.3 Flexible Assignment Builder

Teachers can:

- choose a material;
- select any unit inside it;
- select all units in the material;
- combine selected units into an assignment;
- assign to one or more individual students;
- set deadline;
- set time limit per assignment or override per unit;
- publish assignment.

Examples:

- Assign only Listening Part 2 to one student.
- Assign Listening Parts 1, 3, and 4 to one student.
- Assign all Reading passages to one student.
- Assign Writing Task 2 - Education to one student.
- Assign Speaking Part 2 topic to one student.

### 6.4 Review Submissions

Listening and Reading:

- auto-graded immediately on submit;
- teacher can view score, correct/incorrect/skipped counts, answers, explanations, highlights, notes, time spent, and tab-switch count.

Writing and Speaking:

- appear in a review queue;
- teacher opens attempt;
- teacher enters band score, criteria scores, summary feedback, and detailed feedback;
- student sees result once review is saved.

## 7. Student Workflows

### 7.1 Dashboard

Students see:

- assigned work;
- due dates;
- pending teacher review;
- recently reviewed work;
- ranking;
- attempt history.

### 7.2 Doing Reading

The Reading workspace uses a split layout:

- left panel: passage;
- right panel: questions;
- top bar: test title, student name, timer;
- bottom bar: question navigation and submit button.

Students can:

- answer questions;
- select passage text;
- highlight selected text in multiple colors;
- add a short note to a highlight;
- auto-save answers and highlights;
- submit manually or be auto-submitted when time expires.

### 7.3 Doing Listening

The Listening workspace includes:

- audio player;
- section/part navigation;
- transcript if teacher enables it;
- question panel;
- timer;
- highlight support for transcript text;
- auto-save answers and highlights.

Students can submit manually or be auto-submitted when time expires.

### 7.4 Doing Writing

The Writing workspace includes:

- prompt/instructions;
- essay editor;
- word count;
- timer;
- auto-save draft;
- submit button.

After submission, status becomes pending review until the teacher scores it.

### 7.5 Doing Speaking

The Speaking workspace includes:

- prompt/card;
- preparation guidance;
- record, stop, playback, and submit controls;
- timer if configured.

After submission, status becomes pending review until the teacher listens and scores it.

### 7.6 Reviewing Results

Listening and Reading result pages show:

- score such as `8/10`;
- percentage;
- correct/incorrect/skipped counts;
- question-by-question review;
- student answer;
- correct answer;
- explanation;
- original passage/transcript with saved highlights;
- notes created while doing the task.

Writing and Speaking result pages show:

- status while pending;
- overall band after review;
- criteria scores;
- teacher feedback;
- original response or recording;
- attempt metadata.

### 7.7 History

Students can view all previous attempts with filters:

- skill;
- assignment;
- date;
- reviewed/pending;
- score range.

Each history item links to the full result page.

## 8. Ranking

MVP ranking is class-based.

The initial ranking score can use:

- average score percent for auto-graded Listening/Reading;
- teacher-entered band scores for Writing/Speaking normalized to percent;
- completion rate;
- recent activity.

Ranking should be understandable, not overly complex. Show enough detail so students know why their ranking changed.

## 9. Exam Behavior

MVP includes:

- timer;
- auto-submit when time expires;
- auto-save answers and highlights;
- tab-switch detection;
- warning when students leave the tab;
- tab-switch count stored on Attempt;
- teacher-visible attempt metadata.

MVP does not attempt to fully block tab switching because normal web apps cannot guarantee that without kiosk/browser-level controls.

## 10. UI/UX Direction

The product should feel like a serious IELTS learning and exam workspace.

General direction:

- dark, focused workspace for doing tests;
- clean teacher dashboard for management tasks;
- strong visual distinction between correct, incorrect, skipped, pending, and reviewed states;
- compact navigation for sections, parts, passages, and question numbers;
- no marketing-style landing page as the main app screen.

Teacher UI:

- sidebar navigation;
- dense but readable tables;
- filters for class, student, skill, status, and due date;
- assignment builder with clear unit selection;
- review queue optimized for repeated grading.

Student UI:

- dashboard cards for assigned work and feedback;
- full-screen exam workspace;
- visible timer;
- fixed submit action;
- history and feedback pages that are easy to revisit.

Reading/Listening workspace:

- split view;
- passage/transcript area;
- question area;
- highlight popover after text selection;
- colors for highlights;
- optional note;
- question navigation.

Result UI:

- summary score at top;
- answer status legend;
- question-by-question review;
- correct answer and explanation near the student's answer;
- highlight and notes preserved.

## 11. Testing Plan

### Teacher Workflow Tests

Verify:

- teacher can log in;
- teacher can create a class;
- teacher can add a student;
- teacher can create each skill material;
- teacher can add units to materials;
- teacher can select flexible units for assignment;
- teacher can assign to an individual student;
- teacher can view submitted Listening/Reading results;
- teacher can review Writing/Speaking and return feedback.

### Student Workflow Tests

Verify:

- student can log in with demo account;
- student Google-login flow links to an existing student email;
- unrecognized Google student sees blocked/waiting state;
- student sees assigned work;
- student can answer assigned units;
- student can highlight and note Reading/Listening text;
- student can submit;
- student can view history and results.

### Auto-Grading Tests

Verify:

- exact answers grade correctly;
- skipped answers are counted;
- incorrect answers show correct answer;
- explanations appear in result review;
- score and percentage are calculated correctly.

### Manual Review Tests

Verify:

- Writing submissions enter pending review;
- Speaking recordings enter pending review;
- teacher can save band score and feedback;
- student sees returned review;
- history reflects reviewed state.

### Exam Behavior Tests

Verify:

- timer starts at attempt start;
- answers auto-save;
- highlights auto-save;
- timeout auto-submits;
- manual submit works;
- tab-switch count increments;
- teacher can see submit reason and tab-switch count.

## 12. MVP Exclusions

The MVP will not include:

- absolute browser/tab locking;
- AI grading;
- payment/subscription;
- import from PDF/Word;
- bulk import from Excel/JSON;
- real-time classes;
- native mobile app;
- multi-branch admin center;
- parent portal;
- public marketplace of tests.

## 13. Future Enhancements

After the MVP:

- full IELTS mock test mode with band conversion;
- class-wide assignment shortcuts;
- import from Excel/JSON;
- AI-assisted Writing/Speaking feedback;
- teacher inline comments on Writing;
- stronger analytics by skill and question type;
- anti-cheat improvements;
- parent/student reports;
- public/private material banks;
- Google login for teachers;
- invite links for classes.

## 14. Open Implementation Notes

These are design choices to resolve during implementation planning:

- exact first set of supported Listening/Reading question types;
- whether audio uploads are stored locally in MVP or through object storage;
- final auth package choice;
- final UI component library choice;
- exact ranking formula weights.

Use these conservative defaults unless the implementation plan changes them:

- first question types: short answer, multiple choice, fill in the blank, and true/false/not given;
- local file storage for audio/recordings during development, behind an adapter so object storage can be added later;
- Auth.js/NextAuth-style auth with credentials for teachers and Google provider for students;
- Tailwind CSS plus a component layer such as shadcn/ui if project setup allows it;
- ranking formula: 70% average score, 20% completion rate, 10% recent activity.
