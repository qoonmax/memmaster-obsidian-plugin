/**
 * Delay execution for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if file path contains the specified folder path
 */
export function isFileInFolder(filePath: string, folderPath: string): boolean {
    const folderSegments = folderPath.split('/');
    const filePathSegments = filePath.split('/');
    
    for (let i = 0; i <= filePathSegments.length - folderSegments.length; i++) {
        let match = true;
        for (let j = 0; j < folderSegments.length; j++) {
            if (filePathSegments[i + j] !== folderSegments[j]) {
                match = false;
                break;
            }
        }
        if (match) {
            return true;
        }
    }
    
    return false;
}