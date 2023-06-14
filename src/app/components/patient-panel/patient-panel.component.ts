import { Component, Input } from '@angular/core';
import { AppComponent } from 'src/app/app.component';
import { Cluster } from 'src/app/interfaces/cluster';
import { Patient } from 'src/app/interfaces/patient';
import * as L from 'leaflet';

@Component({
  selector: 'app-patient-panel',
  templateUrl: './patient-panel.component.html',
  styleUrls: ['./patient-panel.component.scss']
})
export class PatientPanelComponent {

  @Input() patient! : Patient;
  @Input() appComponent! : AppComponent;
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
    this.appComponent.OnPatientReassignRequest(event,this.patient);
  }
}
