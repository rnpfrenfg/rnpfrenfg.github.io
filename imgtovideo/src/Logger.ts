
export class Logger{
    private errorDiv: HTMLDivElement;

    constructor(errorId: string){
        this.errorDiv = document.getElementById(errorId) as HTMLDivElement;
    }
    
    public log(...txt: string[]): void{
        console.log(txt);
        this.errorDiv.textContent = txt.join(' ');
    }

    public clear():void{
        this.errorDiv.textContent='';
    }
}