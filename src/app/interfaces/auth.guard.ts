import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, RouterStateSnapshot } from "@angular/router";
import { PermissionsService } from "../services/permissions.service";
import { Router } from '@angular/router';

export const isUserLoggedInGuard = (
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
) => {
    const auth = inject(PermissionsService);
    const router = inject(Router);
    let canActivate : boolean = auth.canActivate();
    if (canActivate)
    {
        return true;
    }
    else
    {
        router.navigateByUrl('/login');
        return false;
    }
};