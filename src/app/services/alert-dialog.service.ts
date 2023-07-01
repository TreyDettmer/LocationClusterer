import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AlertDialogComponent } from '../components/alert-dialog/alert-dialog.component';

@Injectable({
  providedIn: 'root'
})
export class AlertDialogService {

  constructor(public dialog: MatDialog) {}

  public OpenAlertDialog = (data : {message : string, icon : string | undefined, buttonText: string}) =>
  {
    this.dialog.open(AlertDialogComponent,{data});
  }
}
