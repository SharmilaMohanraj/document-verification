# GitHub Setup Instructions

## Steps to Push to GitHub

1. **Create a new repository on GitHub**
   - Go to https://github.com/new
   - Repository name: `document-verification`
   - Description: "Identity verification utility using AWS Textract and Rekognition"
   - Choose Public or Private
   - Do NOT initialize with README, .gitignore, or license (we already have these)

2. **Initialize Git and Push**

```bash
cd document-verification

# Initialize git repository
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Document verification utility"

# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/document-verification.git

# Push to GitHub
git branch -M main
git push -u origin main
```

3. **Update mlbindia-backend package.json**

After pushing to GitHub, update the dependency URL in `mlbindia-backend/package.json`:

```json
{
  "dependencies": {
    "document-verification-utility": "git+https://github.com/YOUR_USERNAME/document-verification.git"
  }
}
```

Replace `YOUR_USERNAME` with your actual GitHub username.

4. **Install in mlbindia-backend**

```bash
cd mlbindia-backend
npm install
```

This will install `document-verification-utility` and all its dependencies from GitHub.

## Using Specific Branch or Tag

### Install from a specific branch:
```json
"document-verification-utility": "git+https://github.com/YOUR_USERNAME/document-verification.git#branch-name"
```

### Install from a specific tag:
```json
"document-verification-utility": "git+https://github.com/YOUR_USERNAME/document-verification.git#v1.0.0"
```

### Install from a specific commit:
```json
"document-verification-utility": "git+https://github.com/YOUR_USERNAME/document-verification.git#commit-hash"
```

## Private Repository

If the repository is private, you'll need to use SSH or provide authentication:

### SSH:
```json
"document-verification-utility": "git+ssh://git@github.com/YOUR_USERNAME/document-verification.git"
```

### HTTPS with token:
```json
"document-verification-utility": "git+https://YOUR_TOKEN@github.com/YOUR_USERNAME/document-verification.git"
```

## Notes

- All dependencies of `document-verification-utility` will be automatically installed in `mlbindia-backend/node_modules` when you run `npm install`
- The utility package itself will be installed as a symlink or copy in `mlbindia-backend/node_modules/document-verification-utility`
- Make sure to update the GitHub URL in `mlbindia-backend/package.json` after creating the repository

