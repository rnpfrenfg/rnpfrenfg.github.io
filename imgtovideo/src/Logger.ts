export class Logger{
    static container = document.createElement('div');
    static zIndex = 1000;

    public static Init(){
        this.container.className = 'alert-container';
        document.body.appendChild(this.container);
    }
    
    public static log(...msg: string[]): void{
        console.log(...msg);

        if (!this.container.parentElement) this.Init();

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