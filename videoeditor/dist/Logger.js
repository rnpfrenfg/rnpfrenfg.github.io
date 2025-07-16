export class Logger {
    static Init() {
        this.container.className = 'alert-container';
        document.body.appendChild(this.container);
    }
    static log(...msg) {
        console.log(...msg);
        if (!this.container.parentElement)
            this.Init();
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert-box';
        alertDiv.textContent = msg.join(' ');
        alertDiv.style.zIndex = `${this.zIndex++}`;
        this.container.appendChild(alertDiv);
        setTimeout(() => {
            alertDiv.style.opacity = '0';
            setTimeout(() => alertDiv.remove(), 300);
        }, 3000);
    }
}
Logger.container = document.createElement('div');
Logger.zIndex = 1000;
