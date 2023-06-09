
import { AfterViewInit, Component, EventEmitter, OnInit, Output } from '@angular/core';
import * as L from 'leaflet';
import * as turf from '@turf/turf';
import { Cluster} from 'src/app/interfaces/cluster';
import { ClusterMarker } from 'src/app/interfaces/cluster-marker';
import { Patient, PatientMarker } from 'src/app/interfaces/patient';
import { KMeans, setBackend, KNeighborsClassifier } from 'scikitjs';
import * as tf from '@tensorflow/tfjs'
import 'overlapping-marker-spiderfier-leaflet/dist/oms';
import 'leaflet-maskcanvas';
var classifyPoint = require('robust-point-in-polygon');
var Rainbow = require('rainbowvis.js');

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss']
})
export class MapComponent implements AfterViewInit {


  private map! : L.Map;
  private mapControls : L.Control.Layers | undefined;
  private markers : L.FeatureGroup = new L.FeatureGroup();

  private largeClusterGroup! : L.MarkerClusterGroup;
  public Clusters : Cluster[] = [];
  public Patients : Patient[] = [];
  private previousClusters : Cluster[] = [];
  private previousUnclusteredPatients : Patient[] = [];

  public CanUndo : boolean = false;
  public UnclusteredPatientCount : number = 1;
  public PatientsAreVisible : boolean = false;

  private miniMarkers : L.FeatureGroup = new L.FeatureGroup();

  private colors : string[] = ["#e6194B"];//,"#3cb44b","#ffe119","#4363d8","#f58231","#911eb4","#42d4f4","#f032e6","#bfef45","#fabed4","#469990","#dcbeff","#9A6324","#fffac8","#800000","#aaffc3","#808000","#ffd8b1","#000075","#a9a9a9"];

  private polygonColorGradient = new Rainbow();

  private startingPatientCount : number = 0;
  
  @Output() OnClusterClicked = new EventEmitter<{cluster : Cluster}>();
  @Output() OnPatientsClicked= new EventEmitter<{patients: Patient[],cluster : Cluster | null}>();
  @Output() OnBoxSelect = new EventEmitter<{bounds : L.LatLngBounds}>();
  @Output() OnClusterMouseOver = new EventEmitter<{clusterIndex : number}>();
  @Output() OnClusterMouseLeave = new EventEmitter<{clusterIndex : number}>();
  @Output() OnDeselect = new EventEmitter<{}>();

  constructor() { }

  ngAfterViewInit(): void {

    this.polygonColorGradient.setSpectrum("#ff0000","#640000");
    this.initMap();
  }


  private initMap(): void 
  {
    // create handler that lets us select multiple patient markers at once
    this.CreateBoxSelectHandler();
    this.map = L.map('map', {
      center: [ 39.8282, -98.5795 ],
      zoom: 4,
      layers: [this.markers,this.miniMarkers,Cluster.LeafletMarkerClustersGroup,Cluster.MappedPolygons,Cluster.MappedPatients]
    });

    const tiles : L.TileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      minZoom: 4,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    tiles.addTo(this.map);

    this.map.on("click",(_:L.LeafletMouseEvent) =>
    {
      let clickedInCluster = false;
      for (let i = 0; i < this.Clusters.length; i++)
      {
        let c = this.Clusters[i];
        if (c.IsPointWithinCluster([_.latlng.lat,_.latlng.lng]))
        {
          clickedInCluster = true;
          break;
        }
      }
      if (!clickedInCluster)
      {
        this.OnDeselect.emit({});
        return;
      }
    })

    this.map.on("dblclick",(_:any) =>
    {
      this.miniMarkers.clearLayers();
    });

    this.map.on("zoomend",() =>
    {
      this.OnZoomChanged();
    });

    this.map.on("boxselectend",(e : any) =>
    {
      let bounds : L.LatLngBounds = e.boxSelectBounds as L.LatLngBounds;
      this.OnBoxSelect.emit({bounds});
    })

    Cluster.Map = this.map;
  }

  public AreMappedPolygonsVisible() : boolean
  {
    return this.map.hasLayer(Cluster.MappedPolygons);
  }

  private StorePreviousClusters()
  {
    this.previousClusters = [];
    for (let i = 0; i < this.Clusters.length; i++)
    {
      let oldCluster = this.Clusters[i];
      let newCluster = this.CloneCluster(oldCluster);
      this.previousClusters.push(newCluster);
    }
    this.previousUnclusteredPatients = [];
    for (let i = 0; i < this.Patients.length; i++)
    {
      let isUnclustered = true;
      for (let j = 0; j < this.Clusters.length; j++)
      {
        if (this.Clusters[j].patients.includes(this.Patients[i]))
        {
          isUnclustered = false;
          break;
        }
      }
      if (isUnclustered)
      {
        let patient = this.Patients[i];
        this.previousUnclusteredPatients.push(patient);
      }
    }
    for (let i = this.Clusters.length - 1; i >= 0; i--)
    {
      if (this.Clusters[i].patients.length <= 0)
      {
        let cluster = this.Clusters[i];
        this.Clusters.splice(i,1);
        cluster.Destroy();
        continue;
      }
    }
  }

  public RestoreClusters()
  {
    if (this.previousClusters.length == 0)
    {
      return;
    }
    this.CanUndo = false;
    for (let i = this.Clusters.length - 1; i >= 0; i--)
    {

      let cluster = this.Clusters[i];
      this.Clusters.splice(i,1);
      cluster.Destroy();
    }
    this.Clusters = [];
    for (let i = 0; i < this.previousClusters.length; i++)
    {
      let oldCluster = this.previousClusters[i];
      let newCluster = this.CloneCluster(oldCluster);
      let clusterPolygon = L.polygon(newCluster.shape,{color:`${newCluster.color}`,weight:2});
      clusterPolygon.on("click",()=>
      {
        this.OnClusterClicked.emit({cluster: newCluster});  
      });
      newCluster.polygon = clusterPolygon;
      if (newCluster.routePolylineShape.length != 0)
      {
        var polyline = L.polyline(newCluster.routePolylineShape,{color: 'blue'});
        newCluster.routePolyline = polyline;
      }
      this.Clusters.push(newCluster);
    }
    for (let i = 0; i < this.previousUnclusteredPatients.length; i++)
    {
      let patientMarker = this.previousUnclusteredPatients[i].marker;
      if (!this.map.hasLayer(patientMarker))
      {
        patientMarker.addTo(this.map);
      }
      patientMarker.setOpacity(1.0);
    }
    this.previousUnclusteredPatients = [];
    this.previousClusters = [];

    // redraw stuff
    this.OnZoomChanged();
    this.GetUnclusteredPatientCount();
  }

  public GetUnclusteredPatientCount() : number
  {
    let patientCount = 0;
    for (let i = this.Clusters.length - 1; i >= 0; i--)
    {
      if (this.Clusters[i].patients.length <= 0)
      {
        let cluster = this.Clusters[i];
        this.Clusters.splice(i,1);
        cluster.Destroy();
        continue;
      }
      patientCount += this.Clusters[i].patients.length;
    }
    this.UnclusteredPatientCount = this.startingPatientCount - patientCount;
    return this.UnclusteredPatientCount;
  }

  private CloneCluster(originalCluster : Cluster)
  {
    let newCluster = new Cluster();
    for (let i = 0; i < originalCluster.patients.length; i++)
    {
      let p = originalCluster.patients[i];
      newCluster.patients.push(p);
    }
    newCluster.shape = JSON.parse(JSON.stringify(originalCluster.shape));
    newCluster.routePolylineShape = JSON.parse(JSON.stringify(originalCluster.routePolylineShape));
    newCluster.color = originalCluster.color;
    newCluster.mapComponent = originalCluster.mapComponent;
    newCluster.milageEstimate = originalCluster.milageEstimate;
    newCluster.isHighlighted = false;
    newCluster.shouldDisplayArea = true;
    newCluster.shouldDisplayPatients = false;
    newCluster.diameter = originalCluster.diameter;
    return newCluster;


  }

  public HideAllDisplayedClusteredPatients()
  {
    for (let i = 0; i < this.Clusters.length; i++)
    {
      this.Clusters[i].shouldDisplayPatients = false;
    }
  }


  public DeleteCluster(cluster : Cluster)
  {
    let clusterIndex = this.Clusters.indexOf(cluster);
    if (clusterIndex < 0)
    {
      return;
    }
    this.StorePreviousClusters();
    this.Clusters.splice(clusterIndex,1);
    let patients = cluster.patients;
    for (let i = 0; i < patients.length; i++)
    {
      if (!this.map.hasLayer(patients[i].marker))
      {
        patients[i].marker.addTo(this.map);
      }
      patients[i].marker.setOpacity(1.0);
    }
    cluster.Destroy();
    this.GetUnclusteredPatientCount();
    this.CanUndo = true;
  }

  private CreateBoxSelectHandler()
  {

    let handler = L.Handler.extend({

      initialize: function (map : L.Map) {
          this._map = map;
          this._container = map.getContainer();
          this._pane = map.getPanes().overlayPane;
          this.enabled = false;
      },
      addHooks: function() {
          L.DomEvent.on(this._container, 'mousedown', this._onMouseDown, this);
      },
  
      removeHooks: function() {
          L.DomEvent.off(this._container, 'mousedown', this._onMouseDown);
      },

      _onMouseDown: function (e : any) {
        if (!e.shiftKey || ((e.which !== 1) && (e.button !== 1))) { return false; }
        this.enabled = true;
        L.DomUtil.disableTextSelection();
    
        this._startLayerPoint = this._map.mouseEventToLayerPoint(e);
    
        this._box = L.DomUtil.create('div', 'leaflet-zoom-box', this._pane);
        L.DomUtil.setPosition(this._box, this._startLayerPoint);
    
        //TODO refactor: move cursor to styles
        this._container.style.cursor = 'crosshair';
    
        L.DomEvent
            .on(document as unknown as HTMLElement, 'mousemove', this._onMouseMove, this)
            .on(document as unknown as HTMLElement, 'mouseup', this._onMouseUp, this)
            .on(document as unknown as HTMLElement, 'keydown', this._onKeyDown, this)
            .preventDefault(e);
    
        this._map.fire('boxzoomstart');
        return true;
      },

      _onMouseMove: function (e : any) {
        var startPoint = this._startLayerPoint,
            box = this._box,
    
            layerPoint = this._map.mouseEventToLayerPoint(e),
            offset = layerPoint.subtract(startPoint),
    
            newPos = new L.Point(
                Math.min(layerPoint.x, startPoint.x),
                Math.min(layerPoint.y, startPoint.y));
    
        L.DomUtil.setPosition(box, newPos);
    
        // TODO refactor: remove hardcoded 4 pixels
        box.style.width  = (Math.max(0, Math.abs(offset.x) - 4)) + 'px';
        box.style.height = (Math.max(0, Math.abs(offset.y) - 4)) + 'px';
      },

      _finish: function () {
        try
        {
          this._pane.removeChild(this._box);
        }
        catch
        {

        }
        
        this._container.style.cursor = '';
    
        L.DomUtil.enableTextSelection();
    
        L.DomEvent
            .off(document as unknown as HTMLElement, 'mousemove', this._onMouseMove)
            .off(document as unknown as HTMLElement, 'mouseup', this._onMouseUp)
            .off(document as unknown as HTMLElement, 'keydown', this._onKeyDown);
      },

      _onMouseUp: function (e : any) {

        this._finish();
    
        var map = this._map,
            layerPoint = map.mouseEventToLayerPoint(e);
    
        if (this._startLayerPoint.equals(layerPoint)) { return; }
    
        var bounds = new L.LatLngBounds(
                map.layerPointToLatLng(this._startLayerPoint),
                map.layerPointToLatLng(layerPoint));
        if (this.enabled == true)
        {
          map.fire('boxselectend',{boxSelectBounds:bounds});
          this.enabled = false;
        }
        

        map.fire('boxzoomend', {
          boxZoomBounds: bounds
        });

      },

      _onKeyDown: function (e : any) {
        if (e.keyCode === 27) {
          this._finish();
        }
      }
    });
    L.Map.mergeOptions({boxSelect: true});
    L.Map.addInitHook('addHandler', 'boxSelect', handler);
    L.Map.mergeOptions({boxZoom: false});
  }

  /**
  * Gets distance in miles between two points on earth.
  * @param {number[]} origin
  * @param {number[]} destination
  */
  private distance(origin : any, destination : any) : number
  {
    let lat1 = origin[0];
    let lon1 = origin[1];
    let lat2 = destination[0];
    let lon2 = destination[1]

    let radius = 6371 // km
    let dlat = (lat2-lat1) * Math.PI/180.0
    let dlon = (lon2-lon1) * Math.PI/180.0
    let a = Math.sin(dlat/2) * Math.sin(dlat/2) + Math.cos(lat1 * Math.PI/180.0) * Math.cos(lat2 * Math.PI/180.0) * Math.sin(dlon/2) * Math.sin(dlon/2)

    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

    let d = radius * c;
    // convert to miles
    d *=  0.621371;
    return d;
  }

  public PanTo(latLng : L.LatLng)
  {
    this.map.panTo(latLng);
  }

  public async CreateClustersFromPatientGroups(patientGroups : Patient[][], allPatients : Patient[], unclusteredPatients : Patient[])
  {
    if (this.Patients.length != 0)
    {
      for (let i = 0; i < this.Patients.length; i++)
      {
        let patientMarker = this.Patients[i].marker;
        try
        {
          patientMarker.removeFrom(this.map);
        }
        catch
        {

        }
      }
    }
    this.Patients = allPatients;
    this.Clusters = [];
    this.ClearMarkers();

    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
    this.map.fitBounds(this.GetBoundsOfPatients(allPatients).pad(0.05));
    await delay(1000);

    for (let i = 0; i < allPatients.length; i++)
    {
      let patient = allPatients[i];
      let marker = new PatientMarker(patient.location,patient,{icon:Patient.DefaultIcon});
      patient.marker = marker;
      marker.on("click",(m) =>
      {
        if (!marker)
        {
          return;
        }
  
        let overlappingPatients = [];
        overlappingPatients.push(patient);
        for (let patientIndex = 0; patientIndex < this.Patients.length; patientIndex++)
        {
          let p = this.Patients[patientIndex];
          if (p == patient)
          {
            continue;
          }
          if (p.longitude == patient.longitude && p.latitude == patient.latitude)
          {
            overlappingPatients.push(p);
          }
        }

        // check if the overlapping patients belong to the same cluster
        let sharedCluster = null;
        for (let patientIndex = 0; patientIndex < overlappingPatients.length; patientIndex++)
        {
          let p = overlappingPatients[patientIndex];
          let shouldBreakOutOfLoop = false;
          for (let clusterIndex = 0; clusterIndex < this.Clusters.length; clusterIndex++)
          {
            let c = this.Clusters[clusterIndex];
            if (c.patients.includes(p))
            {
              if (sharedCluster == null)
              {
                sharedCluster = c;

              }
              else if (sharedCluster != c)
              {
                sharedCluster = null;
                shouldBreakOutOfLoop = true;
                break;
              }
            }
            
          }
          if (shouldBreakOutOfLoop)
          {
            break;
          }
        }
  
  
        // if we can't see the patients then just select the cluster
        if (sharedCluster != null && !sharedCluster.shouldDisplayPatients)
        {
          this.OnClusterClicked.emit({cluster:sharedCluster});
        }
        else
        {
          this.OnPatientsClicked.emit({patients:overlappingPatients,cluster:sharedCluster});
        }
      });
    }




    for (let i = 0; i < patientGroups.length; i++)
    {
      if (patientGroups[i].length == 0)
      {
        continue;
      }
      let patients = patientGroups[i];
      let cluster = new Cluster();
      cluster.mapComponent = this;
      for (let i = 0; i < patients.length; i++)
      {
        cluster.patients.push(patients[i]);
      }
      cluster.color = '#' + this.polygonColorGradient.colourAt(cluster.patients.length);
      let pointsForPolygon = this.GetPointsForPolygon(cluster);
      let hull = this.CalculatePolygonHull(pointsForPolygon);
      let scaledHull = this.GetScaledHull(hull);
      cluster.shape = scaledHull;
      cluster.CalculateDiameter();
      
      let clusterPolygon = L.polygon(cluster.shape,{color:`${cluster.color}`,weight:2});
      clusterPolygon.on("click",()=>
      {
        this.OnClusterClicked.emit({cluster: cluster});  
      });
      cluster.polygon = clusterPolygon;
      cluster.milageEstimate = -1;
      this.Clusters.push(cluster);
    }
    for (let i = 0; i < unclusteredPatients.length; i++)
    {
      
      
      if (!this.map.hasLayer(unclusteredPatients[i].marker))
      {
        unclusteredPatients[i].marker.addTo(this.map);
      }   
      unclusteredPatients[i].marker.setOpacity(1.0);  
    }

    this.startingPatientCount = this.Patients.length;
    this.CreatePatientsMapMask();
    this.UpdateClusterColors();
    this.CanUndo = false;
    // redraw stuff
    this.OnZoomChanged();
    this.GetUnclusteredPatientCount();
  }


  public AutoAssignUnclusteredPatients()
  {
    if (this.GetUnclusteredPatientCount() == 0)
    {
      return;
    }
    this.StorePreviousClusters();

    // get unclustered patients
    let unclusteredPatients = [];
    for (let patientIndex = 0; patientIndex < this.Patients.length; patientIndex++)
    {
      let isClustered = false;
      for (let clusterIndex = 0; clusterIndex < this.Clusters.length; clusterIndex++)
      {
        if (this.Clusters[clusterIndex].patients.includes(this.Patients[patientIndex]))
        {
          isClustered = true;
          break;
        }
      }
      if (!isClustered)
      {
        let patient = this.Patients[patientIndex];
        unclusteredPatients.push(patient);
      }
    }


    function squareDistance(point1 : L.LatLng, point2 : L.LatLng)
    {
      return Math.pow(point2.lat - point1.lat,2) + Math.pow(point2.lng - point1.lng,2);
    }

    // assign each point to its closest cluster
    for (let patientIndex = 0; patientIndex < unclusteredPatients.length; patientIndex++)
    {
      let patient = unclusteredPatients[patientIndex];
      let patientLocation = L.latLng(patient.location);
      let closestCluster = this.Clusters[0];
      let closestDistance = 0;
      if (this.map.hasLayer(this.Clusters[0].polygon))
      {
        closestDistance = squareDistance(patientLocation,this.Clusters[0].polygon.getCenter());
      }
      else
      {
        this.Clusters[0].polygon.addTo(this.map);
        closestDistance = squareDistance(patientLocation,this.Clusters[0].polygon.getCenter());
        this.Clusters[0].polygon.removeFrom(this.map);
      }
      
      for (let clusterIndex = 1; clusterIndex < this.Clusters.length; clusterIndex++)
      {
        let cluster = this.Clusters[clusterIndex];
        let d = 0;
        if (this.map.hasLayer(cluster.polygon))
        {
          d = squareDistance(patientLocation,cluster.polygon.getCenter());
        }
        else
        {
          cluster.polygon.addTo(this.map);
          d = squareDistance(patientLocation,cluster.polygon.getCenter());
          cluster.polygon.removeFrom(this.map);
        }
        if (d < closestDistance)
        {
          closestDistance = d;
          closestCluster = cluster;
        }
      }

      closestCluster.patients.push(patient);
      closestCluster.color = '#' + this.polygonColorGradient.colourAt(closestCluster.patients.length);
      let pointsForPolygon = this.GetPointsForPolygon(closestCluster);
      let hull = this.CalculatePolygonHull(pointsForPolygon);
      let scaledHull = this.GetScaledHull(hull);
      closestCluster.shape = scaledHull;
      closestCluster.CalculateDiameter();
      
      let clusterPolygon = L.polygon(closestCluster.shape,{color:`${closestCluster.color}`,weight:2});
      clusterPolygon.on("click",()=>
      {
        this.OnClusterClicked.emit({cluster: closestCluster});  
      });
      closestCluster.polygon = clusterPolygon;
      closestCluster.milageEstimate = -1;

    }
    // redraw stuff
    this.OnZoomChanged();
    this.CanUndo = true;
    this.GetUnclusteredPatientCount();
    this.UpdateClusterColors();

  }

  public CreateGridClustersFromPatientGroups(patientGroups : Patient[][],oldCluster : Cluster, shouldStorePreviousClusters : boolean = true)
  {
    if (shouldStorePreviousClusters)
    {
      this.StorePreviousClusters();
    }
    

    // remove patients from their original cluster
    for (let n = 0; n < patientGroups.length; n++)
    {
      let patients = patientGroups[n]
      for (let i = 0; i < patients.length; i++)
      {

        let indexOfPatientInCluster = oldCluster.patients.indexOf(patients[i]);
        if (indexOfPatientInCluster >= 0)
        {
          oldCluster.patients.splice(indexOfPatientInCluster,1);
        }
        
      }
    }

    this.ReconfigureClusterShape(oldCluster);

    // remove old cluster
    if (oldCluster.patients.length == 0)
    {
      let clusterIndex = this.Clusters.indexOf(oldCluster);
      this.Clusters.splice(clusterIndex,1);
      oldCluster.Destroy();
    }
    else
    {
      console.warn("old cluster somehow still has patients");
    }

    for (let i = 0; i < patientGroups.length; i++)
    {
      if (patientGroups[i].length == 0)
      {
        continue;
      }
      let patients = patientGroups[i];
      let cluster = new Cluster();
      cluster.mapComponent = this;
      for (let i = 0; i < patients.length; i++)
      {
        cluster.patients.push(patients[i]);
      }
      cluster.color = '#' + this.polygonColorGradient.colourAt(cluster.patients.length);
      let pointsForPolygon = this.GetPointsForPolygon(cluster);
      let hull = this.CalculatePolygonHull(pointsForPolygon);
      let scaledHull = this.GetScaledHull(hull);
      cluster.shape = scaledHull;
      cluster.CalculateDiameter();
      
      let clusterPolygon = L.polygon(cluster.shape,{color:`${cluster.color}`,weight:2});
      clusterPolygon.on("click",()=>
      {
        this.OnClusterClicked.emit({cluster: cluster});  
      });
      cluster.polygon = clusterPolygon;
      cluster.milageEstimate = -1;
      this.Clusters.push(cluster);
    }

    // redraw stuff
    this.OnZoomChanged();
    if (shouldStorePreviousClusters)
    {
      this.CanUndo = true;
    }
    this.GetUnclusteredPatientCount();
    
  }

  public CreateClusterFromSelectedPatients(patients : Patient[], shouldStorePreviousClusters : boolean = true)
  {
    if (shouldStorePreviousClusters)
    {
      this.StorePreviousClusters();
    }
    
    let affectedClusters = [];
    // remove patients from their original cluster
    for (let i = 0; i < patients.length; i++)
    {
      for (let j = 0; j < this.Clusters.length; j++)
      {
        let cluster = this.Clusters[j];
        let indexOfPatientInCluster = cluster.patients.indexOf(patients[i]);
        if (indexOfPatientInCluster >= 0)
        {
          cluster.patients.splice(indexOfPatientInCluster,1);
          affectedClusters.push(cluster);
        }
      }
    }

    for (let i = 0; i < affectedClusters.length; i++)
    {
      this.ReconfigureClusterShape(affectedClusters[i]);
      
    }

    // check for empty clusters to delete
    for (let j = this.Clusters.length - 1; j >= 0; j--)
    {
      let c = this.Clusters[j];
      if (c.patients.length == 0)
      {
        let clusterIndex = this.Clusters.indexOf(c);
        this.Clusters.splice(clusterIndex,1);
        c.Destroy();
      }
    }


    let cluster = new Cluster();
    cluster.mapComponent = this;
    for (let i = 0; i < patients.length; i++)
    {
      cluster.patients.push(patients[i]);
    }
    cluster.color = '#' + this.polygonColorGradient.colourAt(cluster.patients.length);
    let pointsForPolygon = this.GetPointsForPolygon(cluster);
    let hull = this.CalculatePolygonHull(pointsForPolygon);
    let scaledHull = this.GetScaledHull(hull);
    cluster.shape = scaledHull;
    cluster.CalculateDiameter();
    
    let clusterPolygon = L.polygon(cluster.shape,{color:`${cluster.color}`,weight:2});
    clusterPolygon.on("click",()=>
    {
      this.OnClusterClicked.emit({cluster: cluster});  
    });
    cluster.polygon = clusterPolygon;
    cluster.milageEstimate = -1;
    this.Clusters.push(cluster);

    // redraw stuff
    this.OnZoomChanged();
    if (shouldStorePreviousClusters)
    {
      this.CanUndo = true;
    }
    this.GetUnclusteredPatientCount();
  }

  public HandleKmeansResults(originalCluster : Cluster, k : number, labels : number[])
  {
    this.StorePreviousClusters();
    // create the new clusters
    for (let i = 0; i < k; i++)
    {
      let cluster = new Cluster();
      cluster.mapComponent = this;     
      for (let patientIndex = 0; patientIndex < originalCluster.patients.length; patientIndex++)
      {
        if (labels[patientIndex] == i)
        {
          cluster.patients.push(originalCluster.patients[patientIndex])
        }
      }
      if (cluster.patients.length == 0)
      {
        continue;
      }
      cluster.color = '#' + this.polygonColorGradient.colourAt(cluster.patients.length);
      let pointsForPolygon = this.GetPointsForPolygon(cluster);
      let hull = this.CalculatePolygonHull(pointsForPolygon);
      let scaledHull = this.GetScaledHull(hull);
      cluster.shape = scaledHull;
      cluster.CalculateDiameter();
      
      let clusterPolygon = L.polygon(cluster.shape,{color:`${cluster.color}`,weight:2});
      clusterPolygon.on("click",()=>
      {
        this.OnClusterClicked.emit({cluster: cluster});  
      });
      cluster.polygon = clusterPolygon;
      cluster.milageEstimate = -1;
      this.Clusters.push(cluster);
    }

    // handle the original cluster
    let clusterIndex = this.Clusters.indexOf(originalCluster);
    this.Clusters.splice(clusterIndex,1);
    originalCluster.hasBeenPartitioned = true;
    originalCluster.Destroy();


    // redraw stuff
    this.OnZoomChanged();
    this.CanUndo = true;
    this.GetUnclusteredPatientCount();
  }

  public GetPointsForPolygon(cluster : Cluster) : any[]
  {
    let pointsForPolygon = [];
    for (let i = 0; i < cluster.patients.length; i++)
    {
      pointsForPolygon.push(cluster.patients[i].location);
    }
    return pointsForPolygon;
  }

  public GetScaledHull(hull : any, scaleFactor : number = 1.05) : any[]
  {
    let polygon = L.polygon(hull,{weight:2});
    polygon.addTo(this.map);
    let center = [polygon.getCenter().lat,polygon.getCenter().lng];
    polygon.removeFrom(this.map);
    
    let scaledHull = JSON.parse(JSON.stringify(hull));
    
    for (let i = 0; i < scaledHull.length; i++)
    {
      scaledHull[i] = this.GetScaledPoint(scaledHull[i],center,scaleFactor);
    }
    polygon = L.polygon(scaledHull,{weight:1});
    return scaledHull;
  }

  public SwitchPatientsAssignedCluster(patients : Patient[], oldCluster : Cluster | null, newCluster : Cluster)
  {
    
    if (oldCluster == newCluster)
    {
      return;
    }
    this.StorePreviousClusters();

    // calculate shape of new cluster
    
    let pointsForPolygon = this.GetPointsForPolygon(newCluster);

    // add the new patients' locations
    for (let i = 0; i < patients.length; i++)
    {
      pointsForPolygon.push(patients[i].location);
    }
    
    let hull = this.CalculatePolygonHull(pointsForPolygon);
    let scaledHull = this.GetScaledHull(hull);

    newCluster.shape = scaledHull;
    


    // calculate new cluster polygon
    let scaledPolygon = L.polygon(newCluster.shape,{color:`${newCluster.color}`,weight:2});
    scaledPolygon.on("click",()=>
    {
      this.OnClusterClicked.emit({cluster: newCluster});  
    });
    newCluster.polygon = scaledPolygon;



    // remove patients from old cluster
    if (oldCluster != null)
    {
      for (let i = 0; i < patients.length; i++)
      {
        let patientOldIndex = oldCluster.patients.indexOf(patients[i]);
        oldCluster.patients.splice(patientOldIndex,1);
      }

      if (oldCluster.patients.length == 0)
      {
        let clusterIndex = this.Clusters.indexOf(oldCluster);
        this.Clusters.splice(clusterIndex,1);
        oldCluster.Destroy();
        oldCluster = null;
      }
    }

    // add patients to new cluster
    for (let i = 0; i < patients.length; i++)
    {
      newCluster.patients.push(patients[i]);
    }
    // remove any duplicates
    newCluster.patients = Array.from(new Set(newCluster.patients));
    // reset milage estimate since there are new points to account for
    newCluster.milageEstimate = -1;
    newCluster.CalculateDiameter();
    

    if (oldCluster != null)
    {

      let oldPointsForPolygon = this.GetPointsForPolygon(oldCluster);
      let oldHull = this.CalculatePolygonHull(oldPointsForPolygon);

      let oldScaledHull = this.GetScaledHull(oldHull);

      oldCluster.shape = oldScaledHull;
      oldCluster.CalculateDiameter();


      // calculate old cluster polygon
      let oldScaledPolygon = L.polygon(oldCluster.shape,{color:`${oldCluster.color}`,weight:2});
      oldScaledPolygon.on("click",()=>
      {
        this.OnClusterClicked.emit({cluster: oldCluster!});  
      });
      oldCluster.polygon = oldScaledPolygon;
      oldCluster.milageEstimate = -1;
      

    }

    this.OnZoomChanged();
    this.CanUndo = true;
    this.GetUnclusteredPatientCount();
  }


  public GridCutCluster(cluster : Cluster, rows : number, columns : number)
  {
    if (rows <= 0 || columns <= 0)
    {
      return;
    }

    let clusterBounds : L.LatLngBounds = cluster.polygon.getBounds();
    let boundsWidth = Math.abs(clusterBounds.getEast() - clusterBounds.getWest());
    let boundsHeight = Math.abs(clusterBounds.getNorth() - clusterBounds.getSouth());
    let columnWidth = boundsWidth / columns;
    let rowHeight = boundsHeight / rows;
    
    // create array of grid cells
    let gridCells : L.LatLngBounds[] = [];

    for (let row = 0; row < rows; row++)
    {
      for (let column = 0; column < columns; column++)
      {
        let topLeftCorner : L.LatLng = L.latLng(clusterBounds.getNorth() - (row * rowHeight),clusterBounds.getWest() + (column * columnWidth));
        let bottomRightCorner : L.LatLng = L.latLng(clusterBounds.getNorth() - ((row + 1) * rowHeight),clusterBounds.getWest() + ((column + 1) * columnWidth));
        gridCells.push(L.latLngBounds(topLeftCorner,bottomRightCorner));
      }
    }

    let patients = cluster.patients;
    let patientGroups : Patient[][] = [];
    for (let i = 0; i < gridCells.length; i++)
    {
      patientGroups.push([]);
    }
    for (let i = 0; i < patients.length; i++)
    {
      let wasAssigned = false;
      for (let j = 0; j < gridCells.length; j++)
      {
        if (gridCells[j].contains(patients[i].location))
        {
          wasAssigned = true;
          patientGroups[j].push(patients[i]);
        }
      }
      if (!wasAssigned)
      {
        console.log("LOST POINT");
      }
    }

    this.CreateGridClustersFromPatientGroups(patientGroups,cluster);
    

  }

  public OnZoomChanged(cluster? : Cluster)
  {

    this.PatientsAreVisible = false;
    for (let i = 0; i < this.Clusters.length; i++)
    {
      if (this.Clusters[i].shouldDisplayPatients)
      {
        this.PatientsAreVisible = true;
        break;
      }
    }

    if (cluster)
    {
      for (let patientIndex = 0; patientIndex < cluster.patients.length; patientIndex++)
      {
        if (cluster.shouldDisplayPatients)
        {
          
          let patientMarker : PatientMarker = cluster.patients[patientIndex].marker;
          patientMarker.setOpacity(1.0);
          if (!this.map.hasLayer(patientMarker))
          {
            patientMarker.addTo(this.map);
          }
        }
        else
        {
          let patientMarker : PatientMarker = cluster.patients[patientIndex].marker;
          patientMarker.setOpacity(0);  
          if (this.map.hasLayer(patientMarker))
          {
            patientMarker.removeFrom(this.map);
          }   
        }
      }
      return;
    }

    for (let clusterIndex = 0; clusterIndex < this.Clusters.length; clusterIndex++)
    {
      let cluster = this.Clusters[clusterIndex];
      for (let patientIndex = 0; patientIndex < cluster.patients.length; patientIndex++)
      {
        if (cluster.shouldDisplayPatients)
        {
          let patientMarker : PatientMarker = cluster.patients[patientIndex].marker;
          patientMarker.setOpacity(1.0);
          
        }
        else
        {
          let patientMarker : PatientMarker = cluster.patients[patientIndex].marker;
          patientMarker.setOpacity(0);
    
        }
      }
    }
  }

  public HandleBoxSelectEvent(bounds : L.LatLngBounds)
  {
    
  }

  // Populates patients array and enables map layer controls
  public async LoadPatients(patients : Patient[])
  {
    if (this.Patients.length != 0)
    {
      for (let i = 0; i < this.Patients.length; i++)
      {
        let patientMarker = this.Patients[i].marker;
        try
        {
          patientMarker.removeFrom(this.map);
        }
        catch
        {

        }
      }
    }
    this.Patients = patients;
    this.Clusters = [];
    this.ClearMarkers();
    this.CreatePatientsMapMask();
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
    this.map.fitBounds(this.GetBoundsOfPatients(patients).pad(0.05));
    await delay(1000);
  }

  public async CreateMarkerClusters(patients : Patient[], clusterMaxRadius : number)
  {
    if (this.Patients.length != 0)
    {
      for (let i = 0; i < this.Patients.length; i++)
      {
        let patientMarker = this.Patients[i].marker;
        try
        {
          patientMarker.removeFrom(this.map);
        }
        catch
        {

        }
      }
    }
    this.Patients = patients;
    this.Clusters = [];
    this.ClearMarkers();

    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
    this.map.fitBounds(this.GetBoundsOfPatients(patients).pad(0.05));
    await delay(1000);


    var centerLatLng = this.map.getCenter(); // get map center
    var pointC = this.map.latLngToContainerPoint(centerLatLng); // convert to containerpoint (pixels)
    var pointX : L.PointExpression = [pointC.x + 1, pointC.y]; // add one pixel to x
    var pointY : L.PointExpression= [pointC.x, pointC.y + 1]; // add one pixel to y
    
    // convert containerpoints to latlng's
    var latLngC = this.map.containerPointToLatLng(pointC);
    var latLngX = this.map.containerPointToLatLng(pointX);
    var latLngY = this.map.containerPointToLatLng(pointY);
    
    var distanceX = latLngC.distanceTo(latLngX); // calculate distance between c and x (latitude)
    var distanceY = latLngC.distanceTo(latLngY); // calculate distance between c and y (longitude)

    let metersPerPixel = Math.min(distanceX,distanceY);

    //let metersPerPixel = 40075016.686 * Math.abs(Math.cos(this.map.getCenter().lat * Math.PI/180)) / Math.pow(2, this.map.getZoom()+8);
    // (1609 meters in a mile)
    
    let clusterRadius = 1609.34 * clusterMaxRadius / metersPerPixel;
    

    this.largeClusterGroup = L.markerClusterGroup({
      removeOutsideVisibleBounds: true,
      zoomToBoundsOnClick: false,
      showCoverageOnHover: true,
      spiderfyOnMaxZoom: false,
      maxClusterRadius: clusterRadius,
      iconCreateFunction: (cluster) => {
        
        var childCount = cluster.getChildCount();
        var isVisible = false;
        if (this.Clusters.length > 0)
        {
          for (let i = 0; i < this.Clusters.length; i++)
          {
            if (this.Clusters[i].leafletMarkerCluster == cluster)
            {
              childCount = this.Clusters[i].patients.length;
              isVisible = true;
              break;
            }
          }
        }

        if (isVisible == false)
        {
          //return new L.DivIcon({className:"invisible-marker"});
          let html = `
          
          <div style="display:none;">
            <span>${childCount}</span>
            <span aria-label="markers"></span>
          </div>
          `
          //return new L.DivIcon({ html: html});

          return new L.DivIcon({ html: '<div><span><span aria-label="markers"></span>' + '</span></div>', className: "invisible-marker"});
        }
        var c = ' marker-cluster-';
        if (childCount < 10) {
          c += 'small';
        } else if (childCount < 100) {
          c += 'medium';
        } else {
          c += 'large';
        }
    
        return new L.DivIcon({ html: '<div><span>' + childCount + ' <span aria-label="markers"></span>' + '</span></div>', className: 'marker-cluster' + c, iconSize: new L.Point(30, 30) });
      }
    });


    for (let i = 0; i < patients.length; i++)
    {
      let patient = patients[i];
      let marker = new PatientMarker(patient.location,patient,{icon:Patient.DefaultIcon});
      patient.marker = marker;
      marker.on("click",(m) =>
      {
        if (!marker)
        {
          return;
        }
  
        let overlappingPatients = [];
        overlappingPatients.push(patient);
        for (let patientIndex = 0; patientIndex < this.Patients.length; patientIndex++)
        {
          let p = this.Patients[patientIndex];
          if (p == patient)
          {
            continue;
          }
          if (p.longitude == patient.longitude && p.latitude == patient.latitude)
          {
            overlappingPatients.push(p);
          }
        }

        // check if the overlapping patients belong to the same cluster
        let sharedCluster = null;
        for (let patientIndex = 0; patientIndex < overlappingPatients.length; patientIndex++)
        {
          let p = overlappingPatients[patientIndex];
          let shouldBreakOutOfLoop = false;
          for (let clusterIndex = 0; clusterIndex < this.Clusters.length; clusterIndex++)
          {
            let c = this.Clusters[clusterIndex];
            if (c.patients.includes(p))
            {
              if (sharedCluster == null)
              {
                sharedCluster = c;

              }
              else if (sharedCluster != c)
              {
                sharedCluster = null;
                shouldBreakOutOfLoop = true;
                break;
              }
            }
            
          }
          if (shouldBreakOutOfLoop)
          {
            break;
          }
        }
  
  
        // if we can't see the patients then just select the cluster
        if (sharedCluster != null && !sharedCluster.shouldDisplayPatients)
        {
          this.OnClusterClicked.emit({cluster:sharedCluster});
        }
        else
        {
          this.OnPatientsClicked.emit({patients:overlappingPatients,cluster:sharedCluster});
        }
      });
      this.largeClusterGroup.addLayer(marker);

    }


    
    this.startingPatientCount = patients.length;
    console.log(`Starting Patient Count: ${this.startingPatientCount}`);
    this.largeClusterGroup.addTo(Cluster.LeafletMarkerClustersGroup);

    //this.CreatePatientsMapMask();
    this.CanUndo = false;
    this.FindClusters(patients);

  }

  public CreatePatientsMapMask()
  {
    if (this.mapControls !== undefined)
    {
      try
      {
        this.map.removeControl(this.mapControls);
        this.mapControls = undefined;
      }
      catch{}
    }
    let dataForMask = [];
    for (let i = 0; i < this.Patients.length; i++)
    {
      dataForMask.push(this.Patients[i].location);
    }
    // @ts-ignore
    var patientMask = L.TileLayer.maskCanvas(
      {
        radius: 100
      }
    );
    patientMask.setData(dataForMask);

    var mapLayers = {
      "Clusters": Cluster.MappedPolygons,
      "Patients": patientMask
    }

    this.mapControls = L.control.layers(undefined, mapLayers);
    //this.mapControls.
    this.mapControls.addTo(this.map);
  }

  public GetClusterFromPatientMarker(patientMarker : PatientMarker) : Cluster | null
  {
    let cluster : Cluster | null = null;
    for (let i = 0; i < this.Clusters.length; i++)
    {
      
      let patients : Patient[] = this.Clusters[i].patients;
      if (patients.findIndex((patient)=> patient.marker == patientMarker) >= 0)
      {
        cluster = this.Clusters[i];
        break;
      }
    }
    return cluster;
  }

  public async FindClusters(patients : Patient[])
  {
    if (Cluster.LeafletMarkerClustersGroup.getLayers().length == 0)
    {
      return;
    }


    let markerClusters : L.MarkerCluster[] = [];
    this.map.eachLayer((layer : L.Layer) =>
    {
      if (layer instanceof L.MarkerCluster)
      {
        let cluster = new Cluster();
        
        let leafletMarkercluster = layer as L.MarkerCluster;

        leafletMarkercluster.on("click",()=>
        {
          this.OnClusterClicked.emit({cluster});  
          //this.PartitionCluster(cluster);
        })
        cluster.mapComponent = this;
        cluster.leafletMarkerCluster = leafletMarkercluster;
        this.Clusters.push(cluster);

        markerClusters.push(leafletMarkercluster);

      }

    });
    console.log(`Found ${markerClusters.length} main clusters`);
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    // draw the shape/area of each cluster
    for (let i = this.Clusters.length - 1; i >= 0; i--)
    {

      let pointsForPolygon = [];
      let childMarkers = this.Clusters[i].leafletMarkerCluster.getAllChildMarkers();
      for (let j = 0; j < childMarkers.length; j++)
      {
        pointsForPolygon.push([childMarkers[j].getLatLng().lat,childMarkers[j].getLatLng().lng]);
      }
      if (pointsForPolygon.length == 0)
      {
        this.Clusters[i].Destroy();
        this.Clusters.splice(i,1);
        continue;
      }
      else if (pointsForPolygon.length < 15)
      {
        let uniquePoints = Array.from(new Set(pointsForPolygon));
        if (uniquePoints.length == 0)
        {
          this.Clusters[i].Destroy();
          this.Clusters.splice(i,1);
          continue;
        }
      }
      let hull = this.CalculatePolygonHull(pointsForPolygon);

      let polygon = L.polygon(hull,{weight:2});
      polygon.addTo(this.map);
      let center = [polygon.getCenter().lat,polygon.getCenter().lng];
      polygon.removeFrom(this.map);
      // we need to scale up the shape slightly to fit the points that are on the edges
      
      let scaledHull = JSON.parse(JSON.stringify(hull));
      
      let scaleFactor = 1.05;
      for (let i = 0; i < scaledHull.length; i++)
      {
        scaledHull[i] = this.GetScaledPoint(scaledHull[i],center,scaleFactor);
      }

      this.Clusters[i].shape = scaledHull;


      
      
    }

    Cluster.LeafletMarkerClustersGroup.clearLayers();

    for (let patientIndex = 0; patientIndex < patients.length; patientIndex++)
    {
      let foundClusterForPoint : boolean = false;
      for (let clusterIndex = 0; clusterIndex < this.Clusters.length; clusterIndex++)
      {
        if (this.Clusters[clusterIndex].IsPointWithinCluster(patients[patientIndex].location))
        {
          this.Clusters[clusterIndex].patients.push(patients[patientIndex]);
          foundClusterForPoint = true;
          break;
        }

      }

      if (!foundClusterForPoint)
      {
        let patientMarker = patients[patientIndex].marker;
        if (!this.map.hasLayer(patientMarker))
        {
          patientMarker.addTo(this.map);
        }
      }
    }


    // calculate the color of each cluster polygon
    let largestClusterSize = 0;
    let smallestClusterSize = 10000000;
    for (let clusterIndex = 0; clusterIndex < this.Clusters.length; clusterIndex++)
    {
      if (this.Clusters[clusterIndex].patients.length > largestClusterSize)
      {
        largestClusterSize = this.Clusters[clusterIndex].patients.length;
      }
      else if (this.Clusters[clusterIndex].patients.length < smallestClusterSize)
      {
        smallestClusterSize = this.Clusters[clusterIndex].patients.length;
      }
    }

    this.polygonColorGradient.setNumberRange(smallestClusterSize,largestClusterSize);
    for (let clusterIndex = 0; clusterIndex < this.Clusters.length; clusterIndex++)
    {
      let color = '#' + this.polygonColorGradient.colourAt(this.Clusters[clusterIndex].patients.length);
      this.Clusters[clusterIndex].color = color;
      let scaledPolygon = L.polygon(this.Clusters[clusterIndex].shape,{color:`${this.Clusters[clusterIndex].color}`,weight:2});
      let cluster = this.Clusters[clusterIndex];
      scaledPolygon.on("click",()=>
      {
        this.OnClusterClicked.emit({cluster}); 
      });
      this.Clusters[clusterIndex].polygon = scaledPolygon;
      this.Clusters[clusterIndex].CalculateDiameter();
    }


    for (let i = this.Clusters.length - 1; i >= 0; i--)
    {
      if (this.Clusters[i].patients.length == 0)
      {
        this.Clusters[i].Destroy();
        this.Clusters.splice(i,1);
        continue;
      }
      this.ReconfigureClusterShape(this.Clusters[i]);
    }
    this.GetUnclusteredPatientCount();

  }

  public UpdateClusterColors()
  {
    // calculate the color of each cluster polygon
    let largestClusterSize = 0;
    let smallestClusterSize = 10000000;
    for (let clusterIndex = 0; clusterIndex < this.Clusters.length; clusterIndex++)
    {
      if (this.Clusters[clusterIndex].patients.length > largestClusterSize)
      {
        largestClusterSize = this.Clusters[clusterIndex].patients.length;
      }
      else if (this.Clusters[clusterIndex].patients.length < smallestClusterSize)
      {
        smallestClusterSize = this.Clusters[clusterIndex].patients.length;
      }
    }

    this.polygonColorGradient.setNumberRange(smallestClusterSize,largestClusterSize);
    for (let clusterIndex = 0; clusterIndex < this.Clusters.length; clusterIndex++)
    {
      let color = '#' + this.polygonColorGradient.colourAt(this.Clusters[clusterIndex].patients.length);
      this.Clusters[clusterIndex].color = color;
    }
  }

  private CalculatePolygonHull(pointsForPolygon : any[]) : any[]
  {


    var temp = ''
    var uniquePoints = pointsForPolygon.sort().filter(r => {
      if (r.join("") !== temp) {
        temp = r.join("")
        return true
      }
      return false;
    })

    //let uniquePoints = new Set(pointsForPolygon);
    pointsForPolygon = uniquePoints;

    if (pointsForPolygon.length == 0)
    {
      console.error("0 points for unique polygon!");
      return [];
    }

    if (pointsForPolygon.length < 4)
    {
      
      if (pointsForPolygon.length == 0)
      {
        console.error("0 points for unique polygon!");
        return [];
      }
      let turfArray = [];
      for (let i = 0; i < pointsForPolygon.length; i++)
      {
        turfArray.push(turf.point(pointsForPolygon[i]));
      }
      turfArray.push(turf.point(pointsForPolygon[0]));
      var enveloped : turf.helpers.Feature<turf.helpers.Polygon, turf.helpers.Properties> = turf.envelope(turf.featureCollection(turfArray));
      var area : number = turf.area(enveloped);
      // single point so make a box around it
      if (area < 5)
      {
        let points = [];
        let centerPoint = pointsForPolygon[0];
        let centerX = centerPoint[0];
        let centerY = centerPoint[1];
        points.push([centerX + .004,centerY + .004]);
        points.push([centerX + .004,centerY - .004]);
        points.push([centerX - .004,centerY - .004]);
        points.push([centerX - .004,centerY + .004]);
        return this.convexHull(points);
      }
      return this.convexHull(enveloped.geometry.coordinates[0]);

    }
    else
    {
      
      return this.convexHull(pointsForPolygon);
    }

  }

  public async PartitionCluster(cluster : Cluster)
  {
    
    if (cluster.hasBeenPartitioned)
    {
      console.warn("cluster has already been partitioned");
      return;
    }
    this.StorePreviousClusters();
    cluster.hasBeenPartitioned = true;

    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
    this.map.fitBounds(cluster.leafletMarkerCluster.getBounds());
    // provide time for map to zoom in a generate internal cluster icons
    await delay(2000);



    let internalMarkerClusters : L.MarkerCluster[] = this.GetMarkerClustersWithinAreaOnMap(cluster.shape);
    let internalClusterCount = internalMarkerClusters.length;
    let indexOfStartOfInternalClusters = this.Clusters.length;

    for (let i = 0; i < internalMarkerClusters.length; i++)
    {
      let cluster = new Cluster();
      cluster.leafletMarkerCluster = internalMarkerClusters[i];
      cluster.leafletMarkerCluster.on("click",()=>
      {
        this.OnClusterClicked.emit({cluster});    
        //this.PartitionCluster(cluster);
      })
      cluster.mapComponent = this;
      this.Clusters.push(cluster);
    }

    


    // store the shape of each internal cluster

    for (let i = indexOfStartOfInternalClusters; i < this.Clusters.length; i++)
    {
      let pointsForPolygon = [];
      let childMarkers = this.Clusters[i].leafletMarkerCluster.getAllChildMarkers();
      for (let j = 0; j < childMarkers.length; j++)
      {
        pointsForPolygon.push([childMarkers[j].getLatLng().lat,childMarkers[j].getLatLng().lng]);
      }

      let hull = this.CalculatePolygonHull(pointsForPolygon);
      

      let polygon = L.polygon(hull);
      polygon.addTo(this.map);
      let center = [polygon.getCenter().lat,polygon.getCenter().lng];
      polygon.removeFrom(this.map);
      // we need to scale up the shape slightly to fit the points that are on the edges
      let scaledHull = this.GetScaledHull(hull,1.05);

      this.Clusters[i].shape = scaledHull;
      
    }

    let unassignedPatients : Patient[] = [];
    // partition points from the broader cluster into the smaller internal clusters
    // reverse for loop so we can remove points as we iterate
    for (let i = cluster.patients.length - 1; i >= 0; i--)
    {
      let point = cluster.patients[i].location;
      let foundClusterForPoint : boolean = false;
      for (let j = indexOfStartOfInternalClusters; j < this.Clusters.length; j++)
      {
        if (this.Clusters[j].IsPointWithinCluster(point))
        {
          this.Clusters[j].patients.push(cluster.patients[i]);
          foundClusterForPoint = true;
          break;
        }

      }

      if (!foundClusterForPoint)
      {
        unassignedPatients.push(cluster.patients[i]);
      }
      // remove patient from broader cluster
      cluster.patients.splice(i,1);

    }

    // find new cluster homes for unassigned Points
    for (let i = unassignedPatients.length - 1; i >=0; i--)
    {
      for (let j = 0; j < this.Clusters.length; j++)
      {
        if (this.Clusters[j].IsPointWithinCluster(unassignedPatients[i].location))
        {
          // add point to the cluster
          this.Clusters[j].patients.push(unassignedPatients[i]);
          unassignedPatients.splice(i,1);
          break;
        }

      }
    }

    if (cluster.patients.length == 0)
    {
      let clusterIndex = this.Clusters.indexOf(cluster);
      this.Clusters.splice(clusterIndex,1);
      cluster.Destroy();
    }
    else
    {
      this.ReconfigureClusterShape(cluster);
    }

    let patientCount = 0;
    for (let i = this.Clusters.length - 1; i >= 0; i--)
    {
      if (this.Clusters[i].patients.length <= 0)
      {
        let cluster = this.Clusters[i];
        this.Clusters.splice(i,1);
        cluster.Destroy();
        continue;
      }
      patientCount += this.Clusters[i].patients.length;
    }


    // calculate the color of each cluster polygon
    let largestClusterSize = 0;
    let smallestClusterSize = 10000000;
    for (let clusterIndex = 0; clusterIndex < this.Clusters.length; clusterIndex++)
    {
      if (this.Clusters[clusterIndex].patients.length > largestClusterSize)
      {
        largestClusterSize = this.Clusters[clusterIndex].patients.length;
      }
      else if (this.Clusters[clusterIndex].patients.length < smallestClusterSize)
      {
        smallestClusterSize = this.Clusters[clusterIndex].patients.length;
      }
    }

    this.polygonColorGradient.setNumberRange(smallestClusterSize,largestClusterSize);
    for (let clusterIndex = 0; clusterIndex < this.Clusters.length; clusterIndex++)
    {
      let color = '#' + this.polygonColorGradient.colourAt(this.Clusters[clusterIndex].patients.length);
      this.Clusters[clusterIndex].color = color;
      let scaledPolygon = L.polygon(this.Clusters[clusterIndex].shape,{color:`${this.Clusters[clusterIndex].color}`,weight:2});
      let cluster = this.Clusters[clusterIndex];
      scaledPolygon.on("click",()=>
      {
        this.OnClusterClicked.emit({cluster});  
      });
      this.Clusters[clusterIndex].polygon = scaledPolygon;
      this.Clusters[clusterIndex].CalculateDiameter();
    }


    this.OnDeselect.emit({});
    this.CanUndo = true;
    
  }

  private ReconfigureClusterShape(cluster : Cluster)
  {

    let pointsForPolygon = this.GetPointsForPolygon(cluster);
    if (pointsForPolygon.length == 0)
    {
      return;
    }
    let hull = this.CalculatePolygonHull(pointsForPolygon);
    
    let polygon = L.polygon(hull);
    polygon.addTo(this.map);
    let center = [polygon.getCenter().lat,polygon.getCenter().lng];
    polygon.removeFrom(this.map);
    // we need to scale up the shape slightly to fit the points that are on the edges
    let scaledHull = this.GetScaledHull(hull,1.05);

    let scaledPolygon = L.polygon(scaledHull,{color:`${cluster.color}`,weight:2});
    scaledPolygon.on("click",()=>
    {
      this.OnClusterClicked.emit({cluster});  
    });
    cluster.polygon = scaledPolygon;
    cluster.shape = scaledHull;
    cluster.CalculateDiameter();
    this.OnZoomChanged();

  }

  private GetBoundsOfPatients(patients : Patient[]) : L.LatLngBounds
  {
    let locations = [];
    for (let i = 0; i < patients.length; i++)
    {
      locations.push(patients[i].location);
    }
    let convexHull = this.convexHull(locations);
    let polygon = L.polygon(convexHull);
    return polygon.getBounds();
  }


  private GetScaledPoint(point : any[], center : any[], scaleFactor : number) : any[]
  {
    let v2 = [point[0] - center[0],point[1] - center[1]];
    let v2_scaled = [v2[0] * scaleFactor,v2[1] * scaleFactor];
    let v1_scaled = [v2_scaled[0] + center[0],v2_scaled[1] + center[1]];
    return v1_scaled;
  }

  private GetMarkerClustersWithinAreaOnMap(shape : any) : L.MarkerCluster[]
  {
    let internalMarkerClusters : L.MarkerCluster[] = [];
    this.map.eachLayer((layer : L.Layer) => {
        // this will get the new clusters formed by zooming in on the cluster
        if( (layer instanceof L.MarkerCluster || layer instanceof L.Marker))
        {
          // ensure that this layer is actually inside of the broader cluster area
          let isInside = classifyPoint(shape,[layer.getLatLng().lat,layer.getLatLng().lng]);
          if (isInside == -1 || isInside == 0)
          {
            if (layer instanceof L.MarkerCluster)
            {
              internalMarkerClusters.push(layer as L.MarkerCluster);
            }
          }

        }
      }
    );
    return internalMarkerClusters;
  }

  


  public DrawClusterRoundTripRoute(cluster : Cluster, latLngs : L.LatLng[])
  {

    let points = [];
    for (let i = 0; i < latLngs.length; i++)
    {
      
      let latLngAsArray = latLngs[i] as unknown as number[];
      points.push([latLngAsArray[0],latLngAsArray[1]]);
    }
    cluster.routePolylineShape = JSON.parse(JSON.stringify(points)) ;
    var polyline = L.polyline(latLngs,{color: 'blue'});
    cluster.routePolyline = polyline;
  }

  public ClearMarkers()
  {
    this.markers.clearLayers();
    this.miniMarkers.clearLayers();
    Cluster.LeafletMarkerClustersGroup.clearLayers();
    Cluster.MappedPolygons.clearLayers();
    Cluster.MappedPatients.clearLayers();
    
  }

  public UpdateMapCenter(points : any)
  {
    let averageLatitude : number = 0;
    let averageLongitude : number = 0;
    for (let row = 0; row < points.length; row++)
    {
      averageLatitude += points[row][0];
      averageLongitude += points[row][1];
    }
    averageLatitude /= points.length;
    averageLongitude /= points.length;
    this.map.panTo(new L.LatLng(averageLatitude, averageLongitude));
  }



  private getAveragePoint(points : any) : [number, number]
  {
    let averageLatitude : number = 0;
    let averageLongitude : number = 0;
    for (let row = 0; row < points.length; row++)
    {
      averageLatitude += points[row][0];
      averageLongitude += points[row][1];
    }
    averageLatitude /= points.length;
    averageLongitude /= points.length;
    return [averageLatitude,averageLongitude];
  }

  private cross(a : any, b : any, o : any) {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  }
 

  private convexHull(points: any) 
  {
    points.sort(function(a : any, b : any) {
       return a[0] == b[0] ? a[1] - b[1] : a[0] - b[0];
    });
 
    var lower = [];
    for (var i = 0; i < points.length; i++) {
       while (lower.length >= 2 && this.cross(lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0) {
          lower.pop();
       }
       lower.push(points[i]);
    }
 
    var upper = [];
    for (var i = points.length - 1; i >= 0; i--) {
       while (upper.length >= 2 && this.cross(upper[upper.length - 2], upper[upper.length - 1], points[i]) <= 0) {
          upper.pop();
       }
       upper.push(points[i]);
    }
 
    upper.pop();
    lower.pop();
    return lower.concat(upper);
  }


}
