import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
const sha256 = require('sha256');
const secret : string = environment.SITE_ACCESS_SHA256 || "";

@Injectable({
  providedIn: 'root'
})
export class PermissionsService {

  canActivate(): boolean {
    if (sessionStorage.getItem("info") != null && sha256(sessionStorage.getItem("info") as string) == secret)
    {
      console.log("logged in user")
      return true;
    }
    return false;
  }

  hashPasswordInput(password : string) : boolean
  {
    
    let hashedPassword : string = sha256(password) as string;
    if (hashedPassword == secret)
    {
      sessionStorage.setItem("info",password);
      return true;
    }
    return false;
  }
}
