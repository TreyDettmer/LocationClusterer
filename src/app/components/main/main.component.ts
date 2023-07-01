import { Component, AfterViewInit, ViewChild, Input} from '@angular/core';
import { UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { LoadLoggerService } from '../../services/load-logger.service';
import { Status, WorkerResponse } from '../../interfaces/worker-response';
import { MapComponent } from '../../components/map/map.component';
import * as csv from 'csvtojson';
import { MatDialog } from '@angular/material/dialog';
import { ClusterSwitcherDialogComponent } from '../../components/cluster-switcher-dialog/cluster-switcher-dialog.component';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, retry } from 'rxjs/operators';
import { Patient } from '../../interfaces/patient';
import { Cluster } from '../../interfaces/cluster';
import { AppComponent } from 'src/app/app.component';
import * as L from 'leaflet';
import { AlertDialogService } from 'src/app/services/alert-dialog.service';
import { environment } from 'src/environments/environment';
var polyUtil = require('polyline-encoded');

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements AfterViewInit{
  title = 'Location-Cluster';

  private LONGITUDE : string = "longitude";
  private LATITUDE : string = "latitude";

  public Clusters: number[][][] = [];

  public UploadedFile : any = undefined;
  public UploadedFileName : string = "";

  private patients : Patient[] = [];


  private dataFrame : any[] = [];
  private dataFrameLocations!: number[][];

  public ShowSpinner : boolean = false;

  public SelectedCluster : Cluster | null = null;
  public SelectedPatient : Patient | null = null;
  public SelectedPatients : Patient[] = [];
  public IsChoosingNewClusterForPatient : boolean = false;

  private timeOfLastBoxSelect : number = Date.now();


  @ViewChild('map') mapComponent! : MapComponent;
  public HasInitializedMap = false;
  

  settingsForm : UntypedFormGroup = new UntypedFormGroup({
    maxDiameter: new UntypedFormControl(10,[Validators.min(1),Validators.max(25),Validators.required]),
  });


  constructor(public loadLoggerService : LoadLoggerService, public dialog : MatDialog, private http: HttpClient, private alertDialogService : AlertDialogService)
  {
  }

  ngAfterViewInit(): void 
  { 

    this.mapComponent.OnClusterClicked.subscribe(({cluster}) =>
    {
      this.OnClusterClicked(cluster);
    })

    this.mapComponent.OnBoxSelect.subscribe(({bounds}) =>
    {
      this.OnBoxSelect(bounds);
    }) 

    this.mapComponent.OnPatientsClicked.subscribe(({patients, cluster}) =>
    {
      this.OnPatientsClicked(patients,cluster);
    })

    this.mapComponent.OnDeselect.subscribe(({}) =>
    {
      this.OnDeselect();
    })
    this.HasInitializedMap = true;




  }

  public GetClusterEstimatedMilage(event : any)
  {
    if (this.SelectedCluster == null || this.SelectedCluster.patients.length >= 12)
    {
      return;
    }


    // get cluster milage
    this.GetClusterMilage(this.SelectedCluster).subscribe((data:any) => 
    {
      console.log(data);
      if (data.code)
      {
        if (data.code == "Ok")
        {
          if (data.trips.length > 0)
          {
            // 1609 is the number of meters in a mile
            try
            {
              let latlngs = polyUtil.decode(data.trips[0].geometry)
              this.mapComponent.DrawClusterRoundTripRoute(this.SelectedCluster!,latlngs);
            }
            catch (error)
            {
              console.log(error);
            }
            
            let distance = Math.round((data.trips[0].distance / 1609.34) * 10) / 10;
            this.SelectedCluster!.milageEstimate = distance;
          }
        }
        else
        {
          console.log("mapbox API failure");
        }
      }
      else
      {
        console.log("mapbox API failure");
      }
      
    })

  }

  // nullifies selectedCluster and SelectedPatient
  private OnDeselect()
  {
    if (Date.now() - this.timeOfLastBoxSelect < 500)
    {
      return;
    }

    if (this.SelectedCluster != null)
    {
      this.SelectedCluster.isHighlighted = false;
      this.SelectedCluster.shouldDisplayArea = true;
    }
    
    
    this.CancelPatientSelection();
    this.SelectedCluster = null;
  }

  public DeleteCluster(event : any)
  {
    event.preventDefault();
    if (this.SelectedCluster == null)
    {
      return;
    }
    this.mapComponent.DeleteCluster(this.SelectedCluster);
    this.SelectedCluster = null;
  }

  private CancelPatientSelection()
  {
    
    for (let i = 0; i < this.SelectedPatients.length; i++)
    {

      try
      {
        this.SelectedPatients[i].marker.getElement()?.classList.remove('patient-icon-hovered','patient-icon-highlighted');
      }
      catch
      {

      }
      
    }
    this.SelectedPatients = [];
    this.SelectedPatient = null;
  }

  private OnClusterClicked(cluster: Cluster)
  {
    // when we release from the box select, we want to ignore the click from the end mouse release so we wait a little
    if (Date.now() - this.timeOfLastBoxSelect < 500)
    {
      return;
    }
    
    if (this.IsChoosingNewClusterForPatient)
    {
      this.OnPatientReassignConfirmation(cluster);
      return;
    }
    this.CancelPatientSelection();
    if (this.SelectedCluster != null)
    {
      this.SelectedCluster.isHighlighted = false;
      this.SelectedCluster.shouldDisplayArea = true;
    }
    this.SelectedCluster = cluster;
    this.SelectedCluster.isHighlighted = true;

    
  }

  public OnPatientReassignRequest(event : any,patient : Patient | null)
  {
    event.preventDefault();
    if (this.IsChoosingNewClusterForPatient)
    {
      this.IsChoosingNewClusterForPatient = false;
      this.SelectedPatient = null;
      return;
      
    }
    this.IsChoosingNewClusterForPatient = true;
    this.SelectedPatient = patient;

  }

  private OnPatientReassignConfirmation(newCluster : Cluster)
  {
    this.IsChoosingNewClusterForPatient = false;
    if (this.SelectedPatient != null)
    {
      if (this.SelectedCluster == null)
      {
        this.mapComponent.SwitchPatientsAssignedCluster([this.SelectedPatient],null,newCluster);
      }
      else
      {
        this.mapComponent.SwitchPatientsAssignedCluster([this.SelectedPatient],this.SelectedCluster,newCluster);
      }
    }
    else if (this.SelectedPatients.length > 0)
    {
      
      if (this.SelectedCluster == null)
      {
        this.mapComponent.SwitchPatientsAssignedCluster(this.SelectedPatients,null,newCluster);
      }
      else
      {
        this.mapComponent.SwitchPatientsAssignedCluster(this.SelectedPatients,this.SelectedCluster,newCluster);
      }


    }
    this.CancelPatientSelection();
    this.OnDeselect();
  }

  private OnPatientsClicked(patients : Patient[], cluster : Cluster | null)
  {
    if (this.IsChoosingNewClusterForPatient)
    {
      return;
    }
    this.CancelPatientSelection();
    for (let i = 0; i < this.SelectedPatients.length; i++)
    {
      try
      {
        this.SelectedPatients[i].marker.getElement()?.classList.remove('patient-icon-hovered','patient-icon-highlighted');
      }
      catch
      {

      }
    }
    this.SelectedPatients = [];
    for (let i = 0; i < patients.length; i++)
    {
      try
      {
        patients[i].marker.getElement()?.classList.add('patient-icon-highlighted');
      }
      catch
      {

      }
      
      this.SelectedPatients.push(patients[i]);
    }


    if (cluster != null)
    {
      if (this.SelectedCluster != null)
      {
        if (this.SelectedCluster != cluster)
        {
          // assign new selected cluster
          this.SelectedCluster.isHighlighted = false;
          cluster.isHighlighted = true;
          this.SelectedCluster = cluster;
        }
      }
      else
      {
        cluster.isHighlighted = true;
        this.SelectedCluster = cluster;
      }
    }
    else
    {
      if (this.SelectedCluster != null)
      {
        this.SelectedCluster.isHighlighted = false;
        this.SelectedCluster.shouldDisplayArea = true;
        this.SelectedCluster = null;
      }
    }
  }

  private OnBoxSelect(boxBounds : L.LatLngBounds )
  {

    // get the patients within the bounds
    let boundedPatients : Patient[] = [];
    for (let i = 0; i < this.patients.length; i++)
    {
      if (boxBounds.contains(this.patients[i].location))
      {
        boundedPatients.push(this.patients[i]);
      }
    }

    // remove patients that are not visible
    for (let patientIndex = boundedPatients.length - 1; patientIndex >= 0; patientIndex--)
    {
      for (let clusterIndex = 0; clusterIndex < this.mapComponent.Clusters.length; clusterIndex++)
      {
        if (this.mapComponent.Clusters[clusterIndex].patients.includes(boundedPatients[patientIndex]) && !this.mapComponent.Clusters[clusterIndex].shouldDisplayPatients)
        {
          boundedPatients.splice(patientIndex,1);
          break;
        }
      }
    }

    if (boundedPatients.length == 0)
    {
      for (let i = 0; i < this.SelectedPatients.length; i++)
      {
  
        try
        {
          this.SelectedPatients[i].marker.getElement()?.classList.remove('patient-icon-hovered','patient-icon-highlighted');
        }
        catch
        {
  
        }
      }
      this.SelectedPatients = [];
      return;
    }
    




    // ensure that the bounded patients are within the same cluster
    let chosenCluster : Cluster | null = null;
    for (let i = 0; i < this.mapComponent.Clusters.length; i++)
    {
      for (let j = 0; j < boundedPatients.length; j++)
      {
        if (this.mapComponent.Clusters[i].patients.includes(boundedPatients[j]))
        {
          if (chosenCluster != null && chosenCluster != this.mapComponent.Clusters[i])
          {
            console.log("points in different clusters")
            return;
          }
          let c = this.mapComponent.Clusters[i];
          chosenCluster = c;
        }
      }
    }

    // select the cluster of the bounded patients
    if (this.SelectedCluster == null)
    {
      this.SelectedCluster = chosenCluster;
      if (this.SelectedCluster != null)
      {
        this.SelectedCluster.isHighlighted = true;
      }
    }
    else
    {
      this.SelectedCluster.isHighlighted = false;
      this.SelectedCluster = chosenCluster;
      if (this.SelectedCluster != null)
      {
        this.SelectedCluster.isHighlighted = true;
      }
    }

    this.timeOfLastBoxSelect = Date.now();

    // add bounded patients to the BoxSelectPatients array
    for (let i = 0; i < boundedPatients.length; i++)
    {
      this.SelectedPatients.push(boundedPatients[i]);
    }
    this.SelectedPatients = Array.from(new Set(this.SelectedPatients));
    for (let i = 0; i < this.SelectedPatients.length; i++)
    {
      try
      {
        this.SelectedPatients[i].marker.getElement()?.classList.add('patient-icon-highlighted');
      }
      catch
      {

      }
      
    }
  }

  

  
  // called when user uploads a file
  public UploadedFileChanged(e : any)
  {
    if (!e.target.files[0])
    {
      return;
    }
    this.UploadedFile = e.target.files[0];

    let fileReader = new FileReader();
    fileReader.onload = (e) => {
      csv().fromString(fileReader.result as string).then((jsonObj) =>
      {
        this.dataFrame = jsonObj;
        if (!this.isValidCsvFile())
        {
          this.UploadedFile = undefined;
          this.UploadedFileName = "";
          this.dataFrame = [];
          if ((<HTMLInputElement>document.getElementById("file-input")) != null)
          {
            (<HTMLInputElement>document.getElementById("file-input")).value = "";
          }
          
          this.alertDialogService.OpenAlertDialog(
            {message:"Invalid File: missing longitude and/or latitude information",
            buttonText:"Ok",
            icon:undefined}
          );
          return;
        }
        this.UploadedFileName = this.UploadedFile.name;
        this.setLongitudeAndLatitudeConstants();

        this.dataFrameLocations = new Array(this.dataFrame.length).fill([0,0]);
        for (let i = 0; i < this.dataFrame.length; i++)
        {
          let patient = new Patient();
          this.dataFrameLocations[i] = [parseFloat(this.dataFrame[i][this.LATITUDE]),parseFloat(this.dataFrame[i][this.LONGITUDE])];

          patient.latitude = parseFloat(this.dataFrame[i][this.LATITUDE]);
          patient.longitude = parseFloat(this.dataFrame[i][this.LONGITUDE]);        
          patient.patUID = this.dataFrame[i]["PatUID"] as string;
          patient.memberAddress = this.dataFrame[i]["MemberAddress"] as string;
          patient.city = this.dataFrame[i]["City"] as string;
          patient.state = this.dataFrame[i]["State"] as string;
          patient.zip = this.dataFrame[i]["Zip"] as string;
          patient.county = this.dataFrame[i]["County"] as string;
          this.patients.push(patient);
          // replace non numbers with 0
          if (isNaN(this.dataFrameLocations[i][0]))
          {
            console.log(`dataframe[${i}][Latitude]: ${this.dataFrame[i][this.LATITUDE]} is not a number`);
            this.dataFrameLocations[i] = [0,this.dataFrameLocations[i][1]];
          }
          if (isNaN(this.dataFrameLocations[i][1]))
          {
            console.log(`dataframe[${i}][Longitude]: ${this.dataFrame[i][this.LONGITUDE]} is not a number`);
            this.dataFrameLocations[i] = [this.dataFrameLocations[i][0],0];
          }
        }
        this.mapComponent.LoadPatients(this.patients);

      },
      (error) =>
      {
        console.error(error);
      });
    }
    fileReader.onprogress = (data) => 
    {
      if (data.lengthComputable)
      {
        let progress = ((data.loaded / data.total) * 100);
      }
    }
    fileReader.readAsText(this.UploadedFile); 
  }

  public CreateClusterFromSelectedPatients(event : any)
  {
    event.preventDefault();
    if (this.SelectedPatients.length <= 1)
    {
      return;
    }

    this.mapComponent.CreateClusterFromSelectedPatients(this.SelectedPatients);

    this.CancelPatientSelection();

  }

  public AutoPartitionCluster(event : any)
  {
    if (this.SelectedCluster == null)
    {
      return;
    }
    this.mapComponent.PartitionCluster(this.SelectedCluster);
  }

  public RunGridCluster(event : any, rows : number, columns : number)
  {
    event.preventDefault();
    if (this.SelectedCluster == null)
    {
      return;
    }
    this.loadLoggerService.LogMessage("Grid Partitioning");
    this.ShowSpinner = true;
    // we use setTimeout to allow the page to update before doing processing
    setTimeout( async () =>
    {
      if (this.SelectedCluster != null)
      {
        this.mapComponent.GridCutCluster(this.SelectedCluster,rows,columns);
      }
      this.OnDeselect();
      this.loadLoggerService.LogMessage("");
      this.ShowSpinner = false;
    }
    ,100
    );


  }

  public RunKmeans(event : any,k:number)
  {
    event.preventDefault();
    if (this.SelectedCluster == null)
    {
      return;
    }
    this.ShowSpinner = true;
    this.loadLoggerService.LogMessage("Auto Partitioning");
    let patientLocations = [];
    for (let i = 0; i< this.SelectedCluster.patients.length; i++)
    {
      patientLocations.push(this.SelectedCluster.patients[i].location);
    }
    if (typeof Worker !== 'undefined') {
      // Create a new web worker to do the calculations
      const worker = new Worker(new URL('../../app.worker', import.meta.url));
      worker.onmessage = ({data}) => {
        let workerResponse = data as WorkerResponse;
        if (workerResponse.status == Status.Progess)
        {
          this.loadLoggerService.LogMessage(workerResponse.message || "");
        }
        else if (workerResponse.status == Status.Error)
        {
          this.loadLoggerService.LogMessage(workerResponse.message || "",true);
          this.ShowSpinner = false;
        }
        else
        {
          let labels = workerResponse.data.labels;

          if (this.SelectedCluster != null)
          {
            this.SelectedCluster.isHighlighted = false;
            this.mapComponent.HandleKmeansResults(this.SelectedCluster,k,labels);
            this.SelectedCluster = null;
          }
          //this.mapComponent.UpdateMapMarkers(this.Clusters);
          this.loadLoggerService.LogMessage("");
          this.ShowSpinner = false;
        }


      };
      worker.postMessage({
        k:k,
        patientLocations:patientLocations
      });
    } else {
      // Web workers are not supported in this environment.
      // You should add a fallback so that your program still executes correctly.
      console.warn("Workers aren't available");
      this.loadLoggerService.LogMessage("Web Workers are unavailable in your browser",true);
      this.ShowSpinner = false;
    }
  }

  public AutoAssignUnclusteredPatients()
  {
    this.loadLoggerService.LogMessage("Auto Assigning");
    this.ShowSpinner = true;
    // we use setTimeout to allow the page to update before doing processing
    setTimeout( async () =>
    {
      this.mapComponent.AutoAssignUnclusteredPatients();
      this.OnDeselect();
      this.loadLoggerService.LogMessage("");
      this.ShowSpinner = false;
    }
    ,100
    );
  }



  // called when user clicks on 'save clustered data'
  public SaveFile()
  {

    function arrayToCSV (data : any) {
      let csv = data.map((row : any) => Object.values(row));
      csv.unshift(Object.keys(data[0]));
      return `${csv.join('\n').replace(/,/g, ',')}`;
    }

    let clusters : Cluster[] = this.mapComponent.Clusters;

    let additionalClusters = 0;
    // add new cluster column to dataframe
    for (let i = 0; i < this.dataFrame.length; i++)
    {
      let clusterIndex = 0;
      let patUID : string = this.dataFrame[i]["PatUID"] as string;
      let foundClusterWithPatient : boolean = false;
      for (clusterIndex = 0; clusterIndex < clusters.length; clusterIndex++)
      {
        let index = clusters[clusterIndex].patients.findIndex(patient => {
          return patient.patUID === patUID;
        })
        if (index >= 0)
        {
          foundClusterWithPatient = true;
          break;
        }
        
      }
      if (foundClusterWithPatient)
      {
        this.dataFrame[i]["cluster"] = clusterIndex + 1;
      }
      else
      {
        this.dataFrame[i]["cluster"] = -1;
        additionalClusters++;
      }
      
    }

    let fileName = "ClusteredData.csv";
    let fileContent : string = arrayToCSV(this.dataFrame);
    const file = new Blob([fileContent],{type: "text/csv"});
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = fileName;
    link.click();
    link.remove();
  }

  private resetClusterValues()
  {
    for (let i = 0; i < this.dataFrame.length; i++)
    {
      if ("cluster" in this.dataFrame[i])
      {
        this.dataFrame[i]["cluster"] = 0;
      }
    }
  }

  public RestoreClusters(event : any)
  {
    this.OnDeselect();
    this.mapComponent.RestoreClusters();
  }

  private isValidCsvFile() : boolean
  {
    if (!(this.dataFrame[0]["Longitude"] || this.dataFrame[0]["longitude"] || this.dataFrame[0]["Lng"] || this.dataFrame[0]["lng"]))
    {
      return false;
    }
    return true;
  }

  private setLongitudeAndLatitudeConstants()
  {
      if (this.dataFrame[0]["Longitude"])
      {
        this.LONGITUDE = "Longitude";
      }
      else if (this.dataFrame[0]["longitude"])
      {
        this.LONGITUDE = "longitude";
      }
      else if (this.dataFrame[0]["Lng"])
      {
        this.LONGITUDE = "Lng";
      }
      else if (this.dataFrame[0]["lng"])
      {
        this.LONGITUDE = "lng";
      } 

      if (this.dataFrame[0]["Latitude"])
      {
        this.LATITUDE = "Latitude";
      }
      else if (this.dataFrame[0]["latitude"])
      {
        this.LATITUDE = "latitude";
      }
      else if (this.dataFrame[0]["Lat"])
      {
        this.LATITUDE = "Lat";
      }
      else if (this.dataFrame[0]["lat"])
      {
        this.LATITUDE = "lat";
      } 


  }


  async GenerateClusters()
  {

    if (this.patients.length == 0)
    {
      this.alertDialogService.OpenAlertDialog(
        {message:"No data to cluster",
        buttonText:"Ok",
        icon:undefined}
      );
      return;
    }
    if (this.ShowSpinner)
    {
      return;
    }

    this.OnDeselect();
    this.ShowSpinner = true;
    this.mapComponent.ClearMarkers();

    if (this.dataFrame[0]["cluster"] != null)
    {

      this.loadLoggerService.LogMessage("Loading Existing Clusters");
      // we use setTimeout to allow the page to update before doing processing
      setTimeout( async () =>
      {
        let numberOfClusters = [...new Set(this.dataFrame.map(patient => patient["cluster"]))].length;
        let patientGroups : Patient[][] = [];
        let unclusteredPatients : Patient[] = [];
        for (let i = 0; i < numberOfClusters; i++)
        {
          patientGroups.push([]);
        }
        for (let i = 0; i < this.dataFrame.length;i++)
        {
          let clusterIndex : number = this.dataFrame[i]["cluster"] as number;
          if (clusterIndex == -1)
          {
            unclusteredPatients.push(this.patients[i]);
            continue;
          }
          patientGroups[clusterIndex - 1].push(this.patients[i]);
        }
        await this.mapComponent.CreateClustersFromPatientGroups(patientGroups,this.patients,unclusteredPatients);
        this.loadLoggerService.LogMessage("");
        this.ShowSpinner = false;
      }
      ,100
      );

    }
    else
    {

      this.loadLoggerService.LogMessage("Finding Clusters");
      // we use setTimeout to allow the page to update before doing processing
      setTimeout( async () =>
      {
        // we subtract from the provided diameter value because the leaflet marker clusterer doesn't strictly enforce the given diameter
        let diameter = this.settingsForm.controls["maxDiameter"].value - 1.5;
        diameter = Math.max(1.0, diameter);
        await this.mapComponent.CreateMarkerClusters(this.patients,diameter / 2.0);
        this.loadLoggerService.LogMessage("");
        this.ShowSpinner = false;
      }
      ,100
      );
    }
    return;
    
  }

  private GetClusterMilage(cluster : Cluster) : Observable<any>
  {

    let locationsArray = [];
    for (let i = 0; i < cluster.patients.length; i++)
    {
      //mapbox expects longitude then latitude
      locationsArray.push([cluster.patients[i].longitude,cluster.patients[i].latitude]);
    }
    let locationsArrayString1 = [];
    for (let i = 0; i < locationsArray.length; i++)
    {
      locationsArrayString1.push(locationsArray[i].join(','));
    }
    let locationsArrayString = locationsArrayString1.join(';');

    let accessToken : any = environment.MAPBOX_API_ACCESS_TOKEN;
    let baseURL = "https://valhalla1.openstreetmap.de/optimized_route/";
    let url = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${locationsArrayString}?steps=true&access_token=${accessToken}`;
    return this.http.get<any>(url).pipe(
      map((response : any) => {
        return response;
      }),
      catchError((err, caught) => {
        console.error(err);
        throw err;
      }
      )
    )
  }

  CalculateInterquartileRange()
  {
    let latitudes = [];
    let longitudes = [];
    for (let i = 0; i < this.dataFrameLocations.length; i++)
    {
      latitudes.push(this.dataFrameLocations[i][0]);
      longitudes.push(this.dataFrameLocations[i][1]);
    }
    
  }

}


