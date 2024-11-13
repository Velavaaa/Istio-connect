Tutorial: Setting Up Automated Versioning with GitHub Actions and Helm
================================================
Overview
This tutorial guides you through setting up automated versioning, building, and deployment for a Kubernetes application using GitHub Actions and Helm charts. We'll set up a system that automatically versions your containers based on Git commits and deploys them using Helm.
Prerequisites
Git installed
Docker installed and Docker Hub account
Access to a Kubernetes cluster (Minikube for local testing)
Basic understanding of YAML
GitHub account
Helm installed
Project Structure
```
mini-kube-test/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── cd.yml
├── backend/
│   ├── Dockerfile
│   ├── index.js
│   └── package.json
├── frontend/
│   ├── Dockerfile
│   ├── src/
│   └── package.json
└── myapp/              # Helm chart directory
    ├── Chart.yaml
    ├── values.yaml
    └── templates/
        ├── backend-deployment.yaml
        ├── backend-service.yaml
        ├── frontend-deployment.yaml
        ├── frontend-service.yaml
        └── postgres-deployment.yaml
```
Step-by-Step Instructions
Step 1: Repository Setup
Create a new directory for your project:

mkdir mini-kube-test
cd mini-kube-test
git init
Create the GitHub Actions directory structure:
mkdir -p .github/workflows
Step 2: Create CI Workflow
Create .github/workflows/ci.yml:
touch .github/workflows/ci.yml
Add the following content to ci.yml:
# Name of the workflow
name: CI

# When to run this workflow
on:
  push:
    branches: [ main ]  # Runs on pushes to main branch
  pull_request:
    branches: [ main ]  # Runs on PRs targeting main branch

# Environment variables used across jobs
env:
  BACKEND_IMAGE: sivaaira/backend-image    # Change to your Docker Hub username
  FRONTEND_IMAGE: sivaaira/frontend-image   # Change to your Docker Hub username

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      # Step 1: Check out the code
      - name: Checkout code
        uses: actions/checkout@v4

      # Step 2: Generate version number from git commit
      - name: Generate Version
        id: version
        run: |
          echo "VERSION=v$(git rev-parse --short HEAD)" >> $GITHUB_ENV
          echo "version=${{ env.VERSION }}" >> $GITHUB_OUTPUT

      # Step 3: Build backend image
      - name: Build Backend
        run: |
          docker build -t ${{ env.BACKEND_IMAGE }}:${{ env.VERSION }} ./backend
          docker tag ${{ env.BACKEND_IMAGE }}:${{ env.VERSION }} ${{ env.BACKEND_IMAGE }}:latest

      # Step 4: Build frontend image
      - name: Build Frontend
        run: |
          docker build -t ${{ env.FRONTEND_IMAGE }}:${{ env.VERSION }} ./frontend
          docker tag ${{ env.FRONTEND_IMAGE }}:${{ env.VERSION }} ${{ env.FRONTEND_IMAGE }}:latest

      # Step 5: Login to Docker Hub
      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      # Step 6: Push images to Docker Hub
      - name: Push Images
        run: |
          docker push ${{ env.BACKEND_IMAGE }}:${{ env.VERSION }}
          docker push ${{ env.BACKEND_IMAGE }}:latest
          docker push ${{ env.FRONTEND_IMAGE }}:${{ env.VERSION }}
          docker push ${{ env.FRONTEND_IMAGE }}:latest

Step 3: Create CD Workflow
Create .github/workflows/cd.yml:
touch .github/workflows/cd.yml
Add the following content:
# Name of the deployment workflow
name: CD

# Trigger CD after CI workflow completes
on:
  workflow_run:
    workflows: ["CI"]
    types:
      - completed

jobs:
  deploy:
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    steps:
      # Step 1: Check out the code
      - name: Checkout code
        uses: actions/checkout@v4

      # Step 2: Get version from git commit
      - name: Get Version
        id: version
        run: |
          echo "VERSION=v$(git rev-parse --short HEAD)" >> $GITHUB_ENV

      # Step 3: Update Helm values with new image versions
      - name: Update Helm Values
        run: |
          cd myapp
          yq eval ".backend.image.tag = \"${{ env.VERSION }}\"" -i values.yaml
          yq eval ".frontend.image.tag = \"${{ env.VERSION }}\"" -i values.yaml

      # Step 4: Deploy using Helm
      - name: Deploy to Kubernetes
        run: |
          helm upgrade --install myapp ./myapp


Step 4: Create Helm Chart
Create Helm chart structure:

helm create myapp
cd myapp
Update values.yaml:
# Backend configuration
backend:
  image:
    repository: sivaaira/backend-image  # Change to your Docker Hub username
    tag: latest  # This will be automatically updated by CD pipeline
  replicaCount: 1
  service:
    type: ClusterIP
    port: 3000
  env:
    PGUSER: "postgres"
    PGPASSWORD: "password"
    PGDATABASE: "people"
    PGHOST: "postgres-service"
    PGPORT: "5432"

# Frontend configuration
frontend:
  image:
    repository: sivaaira/frontend-image  # Change to your Docker Hub username
    tag: latest  # This will be automatically updated by CD pipeline
  replicaCount: 1
  service:
    type: NodePort
    port: 80
    nodePort: 30001

# PostgreSQL configuration
postgres:
  image:
    repository: postgres
    tag: "13"
  service:
    type: ClusterIP
    port: 5432
  env:
    POSTGRES_USER: "postgres"
    POSTGRES_PASSWORD: "password"
    POSTGRES_DB: "people"


Step 5: Set Up GitHub Secrets
Go to your GitHub repository settings
Navigate to "Secrets and variables" → "Actions"
Add the following secrets:
DOCKERHUB_USERNAME: Your Docker Hub username
DOCKERHUB_TOKEN: Your Docker Hub access token
Step 6: Local Testing	
Test the version generation:



	VERSION="v$(git rev-parse --short HEAD)"
      echo $VERSION



Build images locally:



docker build -t sivaaira/backend-image:${VERSION} ./backend
docker build -t sivaaira/frontend-image:${VERSION} ./frontend

Test Helm chart:

helm lint ./myapp
helm template ./myapp
Step 7: Deploy
Push your code to GitHub:
git add .
git commit -m "Initial setup"
git push origin main
Monitor GitHub Actions:
Go to your repository on GitHub
Click "Actions" tab
Watch the CI/CD pipelines run
Verify deployment:

kubectl get pods
kubectl get services


Automated Versioning and Deployment Strategy - Conceptual Overview
1. Core Concepts
A. Versioning Strategy
We use Git commit SHA as our version number
Example: If commit is abc123456, version becomes v-abc1234
Ensures unique version for every code change
Provides traceability between code and deployment
Makes rollbacks straightforward
B. Key Components
Source Code
Backend (Node.js application)
Frontend (Vue application)
Database (PostgreSQL)
Container Images
Each component packaged as Docker image
Images tagged with Git commit version
Always maintain a 'latest' tag
Helm Charts
Single chart managing all components
Centralized configuration in values.yaml
Version-aware deployments
2. Automation Flow
A. Development Phase
Developer writes code
Commits changes to Git
Pushes to GitHub repository
B. Build Phase (CI)
GitHub Actions triggers on push
Generates version from Git commit
Builds Docker images
Tags with specific version
Tags with 'latest'
Pushes images to Docker Hub
C. Deployment Phase (CD)
Updates Helm chart values
Deploys to Kubernetes
Updates application version
3. Benefits
A. Traceability
Every deployment tied to specific code version
Easy to identify which code is running
Clear audit trail of changes
B. Reliability
Automated process reduces human error
Consistent versioning across all components
Reproducible builds and deployments
C. Maintainability
Easy rollbacks to previous versions
Simple version tracking
Centralized configuration
4. Process Breakdown
A. When Developer Commits Code:
Code Change → Git Commit → GitHub → CI/CD Pipeline

B. During CI (Continuous Integration):
Code → Version Generation → Docker Build → Image Push

C. During CD (Continuous Deployment):
Image → Helm Update → Kubernetes Deployment

5. Version Flow Example
Let's follow a single change:
Developer makes code change
Commits with SHA: abc123456
CI creates images:
backend:vabc1234
frontend:vabc1234
CD updates Helm values with new version
Deploys to Kubernetes with these versions
6. Recovery Process
If something goes wrong:
Identify last working version
Use Helm rollback
System returns to previous state
All components sync to same version


Step 7: creating kubernetes secret for password
    
     $ kubectl create secret generic myapp-database-secret \
     --from-literal=POSTGRES_PASSWORD=password \
     --from-literal=PGPASSWORD=password
     secret/myapp-database-secret created 

    1.change the values in deployment file(postgres/backend)
     add this in env
    - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: myapp-database-secret
                  key: POSTGRES_PASSWORD
      - name: POSTGRES_PASSWORD
              valueFrom:
               secretKeyRef:
                name: myapp-database-secret
                key: POSTGRES_PASSWORD

  
    2.secret is stored in myapp-database-secret
     helm upgrade myapp ./myapp
     


