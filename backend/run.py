if __name__ == "__main__":
    import uvicorn
    import multiprocessing
    
    # On Windows, PyInstaller requires this for multiprocessing to work
    multiprocessing.freeze_support()
    
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False, workers=1)
