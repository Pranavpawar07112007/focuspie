import os
import shutil

HOSTS_FILE = r"C:\Windows\System32\drivers\etc\hosts"
BLOCK_START_MARKER = "# --- FOCUSPIE BLOCK START ---"
BLOCK_END_MARKER = "# --- FOCUSPIE BLOCK END ---"

def block_websites(sites: list[str]):
    if not sites:
        return
        
    try:
        # Create a backup before modifying
        backup_path = HOSTS_FILE + ".focuspie.bak"
        if not os.path.exists(backup_path) and os.path.exists(HOSTS_FILE):
            shutil.copy2(HOSTS_FILE, backup_path)
            
        unblock_websites() # Ensure clean state first
        
        with open(HOSTS_FILE, "a") as f:
            f.write(f"\n{BLOCK_START_MARKER}\n")
            for site in sites:
                # Add common variations
                domain = site.strip()
                if not domain:
                    continue
                f.write(f"127.0.0.1 {domain}\n")
                if not domain.startswith("www."):
                    f.write(f"127.0.0.1 www.{domain}\n")
            f.write(f"{BLOCK_END_MARKER}\n")
    except PermissionError:
        print("Warning: FocusPie needs Administrator privileges to block websites in the hosts file.")
    except Exception as e:
        print(f"Failed to block websites: {e}")

def unblock_websites():
    try:
        if not os.path.exists(HOSTS_FILE):
            return
            
        with open(HOSTS_FILE, "r") as f:
            lines = f.readlines()
            
        with open(HOSTS_FILE, "w") as f:
            skip = False
            for line in lines:
                if line.strip() == BLOCK_START_MARKER:
                    skip = True
                    continue
                elif line.strip() == BLOCK_END_MARKER:
                    skip = False
                    continue
                    
                if not skip:
                    f.write(line)
    except PermissionError:
        print("Warning: FocusPie needs Administrator privileges to unblock websites in the hosts file.")
    except Exception as e:
        print(f"Failed to unblock websites: {e}")
