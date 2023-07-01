import { Component } from '@angular/core';
import { PermissionsService } from 'src/app/services/permissions.service';
import { Router } from '@angular/router';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  public password : string = "";
  public hasAttempted : boolean = false;
  public revealPassword : boolean = false;
  public faEye= faEye;
  public faEyeSlash = faEyeSlash;
  constructor(private permissionsService : PermissionsService, private router : Router)
  {
  }

  public OnPasswordInputChanged()
  {
    this.hasAttempted = false;
    
  }

  public TogglePasswordVisibility()
  {
    this.revealPassword = !this.revealPassword;
  }

  public OnSubmit()
  {
    let isValidLogin = this.permissionsService.hashPasswordInput(this.password);
    if (isValidLogin)
    {
      this.router.navigateByUrl('/main');
    }
    else
    {
      this.password = "";
      this.hasAttempted = true;
    }
  }
}
