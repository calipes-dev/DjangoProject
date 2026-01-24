# How to run the website on your localhost

## Requirements:
- VSCode
- Wampserver or XAMPP
- Python 3.8 or higher

## Step 1: Create virtual environment

**Windows (Command Prompt/PowerShell):**
```bash
python -m venv env
```

**macOS/Linux (Bash/Terminal):**
```bash
python3 -m venv env
```

## Step 2: Activate virtual environment

**Windows (Command Prompt):**
```bash
env\Scripts\activate
```

**Windows (PowerShell):**
```bash
env\Scripts\Activate.ps1
```

**Windows (Git Bash):**
```bash
source env/Scripts/activate
```

**macOS/Linux (Bash/Terminal):**
```bash
source env/bin/activate
```

## Step 3: Install requirements.txt

**All platforms:**
```bash
pip install -r requirements.txt
```

## Step 4: Migrate database

**All platforms:**
```bash
python manage.py makemigrations
python manage.py migrate
```

## Step 5: Create superuser (optional)

**All platforms:**
```bash
python manage.py createsuperuser
```

## Step 6: Run server

**All platforms:**
```bash
python manage.py runserver
```

The website should now be running at: `http://127.0.0.1:8000/`



## Troubleshooting

**If you get "python not found" error on macOS/Linux:**
- Try using `python3` instead of `python`

**If PowerShell script execution is disabled:**
```bash
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**If pip is not recognized:**
```bash
python -m pip install -r requirements.txt
```