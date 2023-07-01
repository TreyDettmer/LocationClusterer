import { Component, Input } from '@angular/core';
import { AppComponent } from 'src/app/app.component';
import { Cluster } from 'src/app/interfaces/cluster';
import { MainComponent } from '../main/main.component';

@Component({
  selector: 'app-cluster-panel',
  templateUrl: './cluster-panel.component.html',
  styleUrls: ['./cluster-panel.component.scss']
})
export class ClusterPanelComponent {
  @Input() cluster! : Cluster;
  @Input() mainComponent! : MainComponent;
  public k : number = 2;
  public rows : number = 2;
  public columns : number = 2;

  public RunKmeans(event : any)
  {
    if (this.k > this.cluster.patients.length)
    {
      return;
    }
    this.mainComponent.RunKmeans(event, this.k);
  }

  public AutoPartition(event : any)
  {
    this.mainComponent.AutoPartitionCluster(event);
  }

  public GetClusterMilage(event : any)
  {
    this.mainComponent.GetClusterEstimatedMilage(event);
  }

  public DeleteCluster(event : any)
  {
    this.mainComponent.DeleteCluster(event);
  }

  public RunGridCluster(event : any)
  {
    this.mainComponent.RunGridCluster(event,this.rows,this.columns);
  }

  public AreGridSettingsValid()
  {
    return !(this.rows < 1 || this.rows >  8 || this.columns < 1 || this.columns > 8 || this.rows == null || this.columns == null || (this.rows == 1 && this.columns == 1))
  }
}
