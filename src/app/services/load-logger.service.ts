import { Injectable } from '@angular/core';
import { Observable, Subject, delay } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoadLoggerService {

  public Message:string = "";

  private messageTimeout : any = null;

  constructor() { }

  public LogMessage(message : string, isTimed : boolean = false)
  {
    this.clearMessageTimeout();
    this.Message = message;
    if (isTimed)
    {
      this.messageTimeout = setTimeout(this.clearMessage,3000);
    }
    
  }

  private clearMessageTimeout()
  {
    if (this.messageTimeout != null)
    {
      clearTimeout(this.messageTimeout)
      this.messageTimeout = null;
    }
  }

  private clearMessage()
  {
    this.Message = "";
  }

}
