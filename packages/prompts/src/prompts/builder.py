from pathlib import Path
from jinja2 import Template

def build_intelligence_prompt(context: dict) -> tuple[str, str]:
    """Load intelligence.md and render with context.
    
    Returns (system_prompt, user_prompt)
    """
    prompt_file = Path(__file__).resolve().parent / "intelligence.md"
    content = prompt_file.read_text(encoding="utf-8")
    
    system_part = ""
    user_part = ""
    
    if "# System Prompt" in content and "# User Prompt" in content:
        parts = content.split("# User Prompt")
        system_part = parts[0].replace("# System Prompt", "").strip()
        user_part = parts[1].strip()
    else:
        user_part = content
        
    system_tmpl = Template(system_part)
    user_tmpl = Template(user_part)
    
    return system_tmpl.render(**context), user_tmpl.render(**context)
