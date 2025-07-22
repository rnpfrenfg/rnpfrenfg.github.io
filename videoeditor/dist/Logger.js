export class Logger {
    static Init() {
        this.container.className = 'alert-container';
        document.body.appendChild(this.container);
    }
    static log(...msg) {
        console.log(...msg);
        if (!this.container.parentElement)
            this.Init();
        const message = msg.join(' ');
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert-box';
        alertDiv.textContent = message;
        this.container.appendChild(alertDiv);
        this.alerts.push(alertDiv);
        if (this.alerts.length > 6) {
            const oldestAlert = this.alerts.shift();
            if (oldestAlert) {
                oldestAlert.style.opacity = '0';
                setTimeout(() => oldestAlert.remove(), 300);
            }
        }
        const duration = 4000;
        setTimeout(() => {
            alertDiv.style.opacity = '0';
            setTimeout(() => {
                alertDiv.remove();
                this.alerts = this.alerts.filter(a => a !== alertDiv);
            }, 300); // fadeOut 애니메이션 시간
        }, duration - 300);
    }
}
Logger.container = document.createElement('div');
Logger.zIndex = 1000;
Logger.alerts = [];
