export const debugLog = (...args: any[]) => {
    setTimeout(() => {
        console.log(...args);
    }, 1000);
}