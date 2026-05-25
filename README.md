# TestForge AI

A powerful, full-stack application designed to analyze user stories and acceptance criteria using advanced NLP pipelines, convert them into Gherkin BDD test cases, and automatically compile them into highly maintainable, Page Object Model (POM) based Playwright automation scripts.

---

## Key Features

1. **Hybrid NLP Gherkin Generation Engine**:
   - **Local Transformers**: Runs inference on HuggingFace `google/flan-t5-small` or your locally fine-tuned variant.
   - **NLP Rule-Based Parser**: A fast, deterministic parser leveraging POS tags and regex heuristics to extract actions and components out of acceptance criteria.
   - **OpenAI GPT-4**: Integrates standard GPT models for complex, multi-scenario Gherkin creation.
2. **Page Object Model (POM) Compiler**:
   - Automatically detects navigation triggers, input fields, button interactions, and outcomes.
   - Compiles Gherkin steps into modular, standard TypeScript POM class structures and test scripts.
3. **Asynchronous Fine-Tuning**:
   - Web interface allowing QA leads to expand the HuggingFace Seq2Seq dataset, verify examples, and dispatch PyTorch fine-tuning tasks in the background.
4. **CI/CD Integration**:
   - Included GitHub Actions workflow setup to run generated tests in parallel.
5. **Docker Environment**:
   - Single-command orchestration for API backend and static React container.

---

## Project Structure

```text
├── .github/workflows/
│   └── playwright.yml            # CI configuration for running tests in parallel
├── backend/
│   ├── dataset.json              # Training corpus mapping stories -> BDD
│   ├── generator.py              # POM and Playwright script compilation logic
│   ├── main.py                   # FastAPI service layer with async training runner
│   ├── nlp_engine.py             # Local T5, spaCy rules, and OpenAI API connectors
│   ├── requirements.txt          # Python dependency specifications
│   ├── test_generator.py         # Automated unit test suite
│   └── train.py                  # PyTorch model fine-tuning routine
├── frontend/
│   ├── src/
│   │   ├── App.tsx               # Glassmorphic React dashboard component
│   │   ├── index.css             # Dark-theme layout stylesheet
│   │   └── main.tsx              # React mounting entrypoint
│   ├── package.json              # Frontend scripts and deps
│   └── vite.config.ts            # Vite asset bundler configuration
├── playwright-infra/
│   ├── playwright.config.ts      # Multi-browser parallel runner settings
│   └── package.json              # Node dev dependencies for Playwright
├── docker-compose.yml            # Local container configuration
├── Dockerfile.backend            # Python environment container recipe
└── Dockerfile.frontend           # Multi-stage static assets serve recipe
```

---

## Local Setup & Run

### Prerequisites

- **Python**: version 3.10 to 3.12 (standard virtualenv setup recommended)
- **NodeJS**: version 20+ and **npm**

---

### Step 1: Run the Backend API

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install required packages:
   ```bash
   pip install -r requirements.txt
   ```
4. Download the default spaCy model:
   ```bash
   python -m spacy download en_core_web_sm
   ```
5. Run the FastAPI development server:
   ```bash
   python main.py
   ```
   The backend API will start at `http://localhost:8000`. You can inspect the interactive docs at `http://localhost:8000/docs`.

---

### Step 2: Run the Frontend App

1. Open a new terminal and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install npm modules:
   ```bash
   npm install
   ```
3. Start the Vite server:
   ```bash
   npm run dev
   ```
   The studio dashboard will open at `http://localhost:5173`.

---

### Step 3: Set Up and Run Playwright Tests

1. Go to the `playwright-infra` directory:
   ```bash
   cd playwright-infra
   ```
2. Install testing tools:
   ```bash
   npm install
   ```
3. Install Playwright browser executables:
   ```bash
   npx playwright install
   ```
4. Put your generated POM classes into `playwright-infra/pages/` and generated spec scripts into `playwright-infra/tests/`, then run the tests:
   ```bash
   npx playwright test
   ```

---

## Run via Docker Compose

To launch the complete application (FastAPI + React UI) instantly in a containerized environment:

1. In the root directory, run:
   ```bash
   docker-compose up --build
   ```
2. Open your browser:
   - **Frontend Dashboard**: `http://localhost:3000`
   - **FastAPI Documentation**: `http://localhost:8000/docs`

---

## Customizing and Fine-Tuning the Local Model

1. Navigate to the **Training Dataset** tab on the React dashboard.
2. Enter custom examples matching your application's wording styles (User Story + Acceptance Criteria -> Target Gherkin).
3. Go to the **AI Training Console** tab.
4. Click **Start Local Model Fine-Tuning**.
5. The backend will trigger `train.py` in a background thread, writing progression logs.
6. Once completed, you can select the **Local Fine-Tuned Seq2Seq Model** in the dropdown on the home workspace to execute tests using your updated model!
