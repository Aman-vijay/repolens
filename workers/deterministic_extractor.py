import json
from pathlib import Path
from sqlalchemy import select
from repolens_db import Repository, RepositoryFile

def extract_facts(db_files: list[RepositoryFile], repo: Repository) -> dict:
    """Extracts framework, package manager, containerization, CI, and license deterministically.
    
    This avoids LLM hallucinations and latency for static metadata.
    """
    facts = {
        "primary_language": None,
        "primary_framework": "Unknown",
        "package_manager": "Unknown",
        "containerized": False,
        "ci_detected": False,
        "license": "Unknown",
        "documentation_quality": "poor",
        "has_tests": False,
        "has_readme": False,
        "fact_sources": {}
    }
    
    # 1. Primary language from repo language stats
    if repo.languages:
        # Find language with highest byte count
        lang_stats = repo.languages
        longest = max(lang_stats.items(), key=lambda x: x[1].get("bytes", 0), default=(None, None))
        if longest[0]:
            facts["primary_language"] = longest[0]
            facts["fact_sources"]["primary_language"] = "deterministic:languages_metadata"
            
    # File map for quick lookups
    file_map = {f.file_path.lower(): f for f in db_files}
    
    # 2. Check README & documentation quality
    readme_file = None
    for k in file_map:
        if "readme" in k:
            readme_file = file_map[k]
            break
            
    if readme_file:
        facts["has_readme"] = True
        facts["fact_sources"]["has_readme"] = f"deterministic:{readme_file.file_path}"
        length = len(readme_file.content)
        if length > 2000:
            facts["documentation_quality"] = "excellent"
        elif length > 500:
            facts["documentation_quality"] = "average"
        else:
            facts["documentation_quality"] = "poor"
        facts["fact_sources"]["documentation_quality"] = f"deterministic:{readme_file.file_path}"
        
    # 3. Docker / Containerization
    if "dockerfile" in file_map or "docker-compose.yml" in file_map:
        facts["containerized"] = True
        matching_file = "dockerfile" if "dockerfile" in file_map else "docker-compose.yml"
        facts["fact_sources"]["containerized"] = f"deterministic:{file_map[matching_file].file_path}"
        
    # 4. CI/CD detection (checking workflows directory in file paths)
    for f in db_files:
        path_lower = f.file_path.lower()
        if ".github/workflows" in path_lower or ".gitlab-ci" in path_lower or "jenkinsfile" in path_lower:
            facts["ci_detected"] = True
            facts["fact_sources"]["ci_detected"] = f"deterministic:{f.file_path}"
            break
            
    # 5. License
    license_file = None
    for k in file_map:
        if "license" in k or "copying" in k:
            license_file = file_map[k]
            break
    if license_file:
        first_line = license_file.content.split("\n")[0].strip()
        # Clean up very basic SPDX matches or fallback to first line prefix
        if "MIT" in license_file.content:
            facts["license"] = "MIT"
        elif "Apache" in license_file.content:
            facts["license"] = "Apache-2.0"
        elif "GPL" in license_file.content:
            facts["license"] = "GPL"
        else:
            facts["license"] = first_line[:30] if first_line else "Present"
        facts["fact_sources"]["license"] = f"deterministic:{license_file.file_path}"
        
    # 6. Test framework detection from tree structure/manifests
    # Look for common test directories
    test_files = [f for f in db_files if "test" in f.file_path.lower()]
    if test_files:
        facts["has_tests"] = True
        facts["fact_sources"]["has_tests"] = "deterministic:test_files_detected"

    # 7. Framework and Package Manager (JS/TS ecosystem)
    if "package.json" in file_map:
        try:
            pkg_data = json.loads(file_map["package.json"].content)
            deps = {**pkg_data.get("dependencies", {}), **pkg_data.get("devDependencies", {})}
            
            # Frameworks
            if "next" in deps:
                facts["primary_framework"] = "Next.js"
            elif "express" in deps:
                facts["primary_framework"] = "Express"
            elif "react" in deps:
                facts["primary_framework"] = "React"
            elif "vue" in deps:
                facts["primary_framework"] = "Vue"
            elif "nuxt" in deps:
                facts["primary_framework"] = "Nuxt"
            elif "svelte" in deps:
                facts["primary_framework"] = "Svelte"
                
            facts["fact_sources"]["primary_framework"] = "deterministic:package.json"
            
            # Package Manager
            for k in file_map:
                if "pnpm-lock.yaml" in k:
                    facts["package_manager"] = "pnpm"
                elif "package-lock.json" in k:
                    facts["package_manager"] = "npm"
                elif "yarn.lock" in k:
                    facts["package_manager"] = "yarn"
            if facts["package_manager"] == "Unknown":
                facts["package_manager"] = "npm" # Default fallback for JS
            facts["fact_sources"]["package_manager"] = "deterministic:lockfile_detection"
        except Exception:
            pass
            
    # 8. Framework and Package Manager (Python ecosystem)
    elif "pyproject.toml" in file_map:
        content = file_map["pyproject.toml"].content
        # Simple string matching for speed/simplicity
        if "fastapi" in content.lower():
            facts["primary_framework"] = "FastAPI"
        elif "django" in content.lower():
            facts["primary_framework"] = "Django"
        elif "flask" in content.lower():
            facts["primary_framework"] = "Flask"
        facts["fact_sources"]["primary_framework"] = "deterministic:pyproject.toml"
        
        # Package Manager
        for k in file_map:
            if "poetry.lock" in k:
                facts["package_manager"] = "poetry"
            elif "uv.lock" in k:
                facts["package_manager"] = "uv"
            elif "pdm.lock" in k:
                facts["package_manager"] = "pdm"
        if facts["package_manager"] == "Unknown":
            facts["package_manager"] = "pip"
        facts["fact_sources"]["package_manager"] = "deterministic:lockfile_detection"

    elif "go.mod" in file_map:
        facts["primary_framework"] = "Standard Library (Go)"
        facts["package_manager"] = "go modules"
        facts["fact_sources"]["primary_framework"] = "deterministic:go.mod"
        facts["fact_sources"]["package_manager"] = "deterministic:go.mod"
        
    return facts
