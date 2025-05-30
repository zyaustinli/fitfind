#!/usr/bin/env python3
"""
Development startup script for FitFind
Runs both Flask backend and Next.js frontend simultaneously
"""

import subprocess
import sys
import os
import time
import signal
from pathlib import Path

def check_requirements():
    """Check if required files exist"""
    required_files = [
        'app.py',
        'search_recommendation.py',
        'requirements.txt',
        'fitfind-frontend/package.json'
    ]
    
    missing_files = []
    for file in required_files:
        if not os.path.exists(file):
            missing_files.append(file)
    
    if missing_files:
        print("❌ Missing required files:")
        for file in missing_files:
            print(f"   - {file}")
        return False
    
    return True

def check_env_file():
    """Check if .env file exists and has required variables"""
    env_file = Path('.env')
    if not env_file.exists():
        print("⚠️  No .env file found. Creating from template...")
        template_file = Path('env_template.txt')
        if template_file.exists():
            with open(template_file, 'r') as f:
                template_content = f.read()
            with open('.env', 'w') as f:
                f.write(template_content)
            print("✅ Created .env file from template")
            print("📝 Please edit .env file with your API keys before running the app")
            return False
        else:
            print("❌ No env_template.txt found. Please create .env file manually")
            return False
    
    # Check for required environment variables
    required_vars = ['OPENAI_API_KEY', 'GOOGLE_API_KEY', 'SERPAPI_API_KEY']
    with open('.env', 'r') as f:
        env_content = f.read()
    
    missing_vars = []
    for var in required_vars:
        if f"{var}=" not in env_content or f"{var}=your_" in env_content:
            missing_vars.append(var)
    
    if missing_vars:
        print("⚠️  Missing or incomplete environment variables in .env:")
        for var in missing_vars:
            print(f"   - {var}")
        print("📝 Please update your .env file with valid API keys")
        return False
    
    return True

def install_python_deps():
    """Install Python dependencies"""
    print("📦 Installing Python dependencies...")
    try:
        result = subprocess.run([sys.executable, '-m', 'pip', 'install', '-r', 'requirements.txt'], 
                      check=True, capture_output=True, text=True)
        print("✅ Python dependencies installed")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install Python dependencies: {e}")
        print("📋 Error details:")
        if e.stdout:
            print("STDOUT:")
            print(e.stdout)
        if e.stderr:
            print("STDERR:")
            print(e.stderr)
        print("\n💡 Suggestions:")
        print("   - Try upgrading pip: python -m pip install --upgrade pip")
        print("   - Check if you have a Python virtual environment activated")
        print("   - Some packages might need Visual Studio Build Tools on Windows")
        return False

def install_node_deps():
    """Install Node.js dependencies"""
    print("📦 Installing Node.js dependencies...")
    try:
        # Try different npm commands for Windows compatibility
        npm_commands = ['npm', 'npm.cmd', 'npm.exe']
        
        for npm_cmd in npm_commands:
            try:
                result = subprocess.run([npm_cmd, 'install'], 
                                      cwd='fitfind-frontend', 
                                      check=True, capture_output=True, text=True)
                print("✅ Node.js dependencies installed")
                return True
            except FileNotFoundError:
                continue
            except subprocess.CalledProcessError as e:
                print(f"❌ Failed to install Node.js dependencies with {npm_cmd}: {e}")
                print(f"Error output: {e.stderr}")
                return False
        
        # If all npm commands failed
        print("❌ npm not found. Please install Node.js")
        print("💡 Tip: Make sure Node.js is installed and npm is in your PATH")
        return False
        
    except Exception as e:
        print(f"❌ Unexpected error installing Node.js dependencies: {e}")
        return False

def start_backend():
    """Start Flask backend"""
    print("🚀 Starting Flask backend on http://localhost:5000")
    return subprocess.Popen([sys.executable, 'app.py'])

def start_frontend():
    """Start Next.js frontend"""
    print("🚀 Starting Next.js frontend on http://localhost:3000")
    
    # Try different npm commands for Windows compatibility
    npm_commands = ['npm', 'npm.cmd', 'npm.exe']
    
    for npm_cmd in npm_commands:
        try:
            return subprocess.Popen([npm_cmd, 'run', 'dev'], cwd='fitfind-frontend')
        except FileNotFoundError:
            continue
    
    # If all npm commands failed
    print("❌ Could not start frontend: npm not found")
    return None

def main():
    print("🎯 FitFind Development Server Startup")
    print("=" * 50)
    
    # Check requirements
    if not check_requirements():
        print("❌ Requirements check failed")
        return 1
    
    # Check environment file
    if not check_env_file():
        print("❌ Environment setup incomplete")
        return 1
    
    # Install dependencies
    if not install_python_deps():
        return 1
    
    if not install_node_deps():
        return 1
    
    print("\n🎉 Setup complete! Starting servers...")
    print("=" * 50)
    
    # Start both servers
    backend_process = None
    frontend_process = None
    
    try:
        backend_process = start_backend()
        time.sleep(3)  # Give backend time to start
        
        frontend_process = start_frontend()
        
        if frontend_process is None:
            print("❌ Failed to start frontend server")
            if backend_process:
                backend_process.terminate()
            return 1
        
        print("\n✅ Both servers are running!")
        print("🌐 Frontend: http://localhost:3000")
        print("🔧 Backend API: http://localhost:5000")
        print("📚 API Health: http://localhost:5000/api/health")
        print("\n💡 Press Ctrl+C to stop both servers")
        
        # Wait for processes
        while True:
            time.sleep(1)
            
            # Check if processes are still running
            if backend_process.poll() is not None:
                print("❌ Backend process stopped unexpectedly")
                break
            if frontend_process and frontend_process.poll() is not None:
                print("❌ Frontend process stopped unexpectedly")
                break
                
    except KeyboardInterrupt:
        print("\n🛑 Shutting down servers...")
        
    finally:
        # Clean up processes
        if backend_process:
            backend_process.terminate()
            try:
                backend_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                backend_process.kill()
        
        if frontend_process:
            frontend_process.terminate()
            try:
                frontend_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                frontend_process.kill()
        
        print("✅ Servers stopped")
    
    return 0

if __name__ == "__main__":
    sys.exit(main()) 