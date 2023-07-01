import { Injectable } from '@angular/core';
const sha256 = require('sha256');
const secret : string = process.env['SITE_ACCESS_SHA256'] || "";// "738ef1c0f31e0da20e0e635108cce5dc7c71062628b143d7ee1f0083e04e05b2";
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
