export class Logger{
    static container = document.createElement('div');
    static zIndex = 1000;
    static alerts: HTMLDivElement[] = [];

    public static Init(){
        this.container.className = 'alert-container';
        document.body.appendChild(this.container);
    }

    public static log(...msg: string[]): void{
        console.log(...msg);

        if (!this.container.parentElement) this.Init();

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