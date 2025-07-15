export class Logger {
    constructor(errorId) {
        this.errorDiv = document.getElementById(errorId);
    }
    log(...txt) {
        console.log(txt);
        this.errorDiv.textContent = txt.join(' ');
    }
    clear() {
        this.errorDiv.textContent = '';
    }
}
