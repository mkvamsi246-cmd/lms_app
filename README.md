# Course Roadmap LMS

Node.js + Express + MongoDB backend with a built-in web frontend (served as static
files), plus an Android Studio WebView wrapper so it installs as an Android app.

## 1. Backend setup

```bash
cd lms-app
npm install
cp .env.example .env      # then edit MONGO_URI / JWT_SECRET
npm run dev                # or: npm start
```

Make sure MongoDB is running locally (or point MONGO_URI at Atlas).

### Create the first faculty login
Faculty registration is itself a faculty-only route (so faculty can't be created by
random students), so bootstrap the first one directly:

```bash
node utils/seedFaculty.js admin@college.edu "Admin@123" "Main Admin"
```

Then log in at `/index.html` → Faculty tab, and use the "Register another faculty"
API (`POST /api/faculty/register`, while logged in as faculty) to add more.

### Try it
Open `http://localhost:5000` — role tabs for Student / Faculty, registration
dropdowns are pulled live from `/api/auth/student/options`.

## 2. What's implemented vs. what to extend

Implemented: student registration (with branch/section/year dropdowns + password
rules) and login; faculty login; course creation; entrance test creation & auto-
grading for single/mcq questions; entrance results surfaced to faculty; per-student
roadmap builder with weekly video/ppt/docx/pdf uploads (stored on local disk under
`/uploads`); day-3/7/21/weekly exam attachment per week; exam-taking UI with a
countdown timer, a 3-tab-switch limit (auto-submits the exam past the limit), and
copy/paste blocking on coding-question textareas; full proctoring log (tab switches,
paste attempts, timestamps) stored per submission and visible to faculty.

Left as an extension point: **actual code execution for coding questions**. Grading
currently compares `output` you supply against expected test-case output
(`routes/submission.js` → `gradeCodingAnswer`). For real code execution, wire that
function to a sandboxed runner — the common approach is calling the Judge0 API, or
running a Docker container per submission. Do not `eval()` untrusted student code
directly in your Node process.

A `node-cron` dependency is included but not wired up — use it in `utils/` if you
want the day-3/7/21 exams to auto-unlock/notify on schedule rather than being
manually attached by faculty.

## 3. Android Studio (WebView wrapper)

This turns the web app into an installable Android app by pointing a WebView at your
deployed server URL. Create a new "Empty Views Activity" project in Android Studio,
then:

**`app/src/main/AndroidManifest.xml`** — add above `<application>`:
```xml
<uses-permission android:name="android.permission.INTERNET" />
```
If you serve over plain HTTP (not HTTPS) during development, also add
`android:usesCleartextTraffic="true"` to the `<application>` tag.

**`app/src/main/res/layout/activity_main.xml`**:
```xml
<?xml version="1.0" encoding="utf-8"?>
<WebView xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/webview"
    android:layout_width="match_parent"
    android:layout_height="match_parent" />
```

**`app/src/main/java/.../MainActivity.java`**:
```java
package com.yourcollege.lms;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    private static final String APP_URL = "https://your-deployed-domain.com";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        WebView webView = findViewById(R.id.webview);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);   // required: app uses localStorage for the JWT session
        settings.setDatabaseEnabled(true);

        webView.setWebViewClient(new WebViewClient()); // keeps navigation inside the WebView
        webView.loadUrl(APP_URL);
    }

    @Override
    public void onBackPressed() {
        WebView webView = findViewById(R.id.webview);
        if (webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }
}
```

Notes:
- The exam page relies on `document.visibilitychange` for tab-switch detection —
  inside a WebView this reliably fires when the user switches to another app or
  the home screen, which is the equivalent event on Android.
- Deploy the Node server somewhere reachable (Render/Railway/a VPS/your college
  server) with HTTPS before pointing production builds at it — WebView blocks
  mixed content and cleartext HTTP by default on modern Android.
- File uploads (faculty side) use a native `<input type="file">`; WebView needs
  `onShowFileChooser` overridden on `WebChromeClient` to open the Android file
  picker — ask me for that snippet if faculty will upload from the Android app
  rather than a desktop browser.

## 4. Folder structure
```
lms-app/
├── config/db.js
├── models/          Student, Faculty, Course, Question, Test, Roadmap, Submission
├── middleware/       auth.js (JWT), upload.js (multer, disk storage)
├── routes/           auth, student, faculty, course, test, submission, roadmap
├── public/           index.html, student.html, faculty.html, exam.html, css/, js/
├── uploads/          videos/ ppt/ docx/ pdf/  (created on disk, gitignore this)
└── server.js
```
