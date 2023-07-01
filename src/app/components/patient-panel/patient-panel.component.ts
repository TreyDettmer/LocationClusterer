import { Component, Input } from '@angular/core';
import { AppComponent } from 'src/app/app.component';
import { Cluster } from 'src/app/interfaces/cluster';
import { Patient } from 'src/app/interfaces/patient';
import * as L from 'leaflet';
import { MainComponent } from '../main/main.component';

@Component({
  selector: 'app-patient-panel',
  templateUrl: './patient-panel.component.html',
  styleUrls: ['./patient-panel.component.scss']
})
export class PatientPanelComponent {

  @Input() patient! : Patient;
  @Input() mainComponent! : MainComponent;
  @Input() cluster! : Cluster | null;
  public OnMouseEnter(event : any)
  {

      try
      {
        this.patient.marker.getElement()?.classList.add('patient-icon-hovered');
      }
      catch
      {

      }
  }

  public OnMouseLeave(event : any)
  {
    try
    {
      this.patient.marker.getElement()?.classList.remove('patient-icon-hovered');
    }
    catch
    {

    }
  }

  public ReassignClusterRequest(event : any)
  {
    this.mainComponent.OnPatientReassignRequest(event,this.patient);
  }
}
