import { Component, OnInit, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ClusterSwitcherResponse } from 'src/app/interfaces/cluster-switcher-response';

@Component({
  selector: 'app-cluster-switcher-dialog',
  templateUrl: './cluster-switcher-dialog.component.html',
  styleUrls: ['./cluster-switcher-dialog.component.scss']
})
export class ClusterSwitcherDialogComponent implements OnInit {

  constructor(public dialogRef : MatDialogRef<ClusterSwitcherDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ClusterSwitcherResponse,) { }

  ngOnInit(): void {
  }

  onNoClick(): void {
    this.dialogRef.close();
  }

}
