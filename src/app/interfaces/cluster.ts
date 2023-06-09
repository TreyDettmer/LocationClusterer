import * as L from 'leaflet';
import { Patient, PatientMarker } from './patient';
import { MapComponent } from '../components/map/map.component';
import * as turf from '@turf/turf';
var classifyPoint = require('robust-point-in-polygon');
export class Cluster
{
    // static reference to the leaflet map
    static Map : L.Map | undefined;

    private _mapComponent!: MapComponent;

    static LeafletMarkerClustersGroup : L.FeatureGroup = new L.FeatureGroup();

    static MappedPolygons : L.FeatureGroup = new L.FeatureGroup();

    static MappedPatients : L.FeatureGroup = new L.FeatureGroup();

    // Leaflet polygon drawn on map
    private _polygon : L.Polygon | undefined;
    // shape of the cluster used to determine if point is inside of cluster
    private _shape : any[] | undefined;
    // patients within the cluster
    private _patients: Patient[] = [];
    // the clickable cluster icon for this cluster
    private _leafletMarkerCluster : L.MarkerCluster | undefined;

    private _hasBeenPartitioned : boolean = false;

    private _color : string = "#0d0d0d";

    private _shouldDisplayPatients : boolean = false;

    private _shouldDisplayArea: boolean = true;


    private _isHighlighted: boolean = false;

    private _milageEstimate: number = -1;

    private _diameter: number = -1;

    private _routePolyline: L.Polyline | undefined;

    private _routePolylineShape: any[] = [];





    constructor()
    {
      this._shape = [];
    }


    public IsPointWithinCluster(point : any[]) : boolean
    {
      let isInside = classifyPoint(this._shape,point);

      // if the point is inside or on the edge of a cluster boundary, then include it
      if (isInside == -1 || isInside == 0)
      {
        return true;
      }
      return false;
    }

    public Destroy()
    {
      if (this._leafletMarkerCluster !== undefined)
      {
        try
        {
          Cluster.LeafletMarkerClustersGroup.removeLayer(this._leafletMarkerCluster as L.Layer);
        }
        catch
        {
        
        }
      }
      
      try
      {
        Cluster.MappedPolygons.removeLayer(this._polygon as L.Layer);
      }
      catch
      {

      }
      try
      {
        Cluster.MappedPolygons.removeLayer(this._routePolyline as L.Layer);
      }
      catch
      {

      }
    }

    public get diameter(): number {
      return this._diameter;
    }
    public set diameter(value : number) {
      this._diameter = value;
    }

    public get routePolyline(): L.Polyline{
      return this._routePolyline!;
    }
    public set routePolyline(value: L.Polyline) {


      try
      {
        Cluster.MappedPolygons.removeLayer(this._routePolyline as L.Layer);
      }
      catch
      {

      }
      this._routePolyline = value;
      this._routePolyline.addTo(Cluster.MappedPolygons);
    }

    public get routePolylineShape(): any[] {
      return this._routePolylineShape;
    }
    public set routePolylineShape(value: any[]) {
      this._routePolylineShape = value;
    }

    public get milageEstimate(): number {
      return this._milageEstimate;
    }
    public set milageEstimate(value: number) {
      this._milageEstimate = value;
    }

    public get isHighlighted(): boolean {
      return this._isHighlighted;
    }
    public set isHighlighted(value: boolean) {
      if (this.isHighlighted == value)
      {
        return;
      }
      this._isHighlighted = value;
      if (this._isHighlighted == true)
      {
        if (this._polygon)
        {
          this._polygon.setStyle({color:"#f7be00"});
        }
      }
      else
      {
        if (this._polygon)
        {
          this._polygon.setStyle({color:this._color});
        }
      
      }
    }

    public get mapComponent(): MapComponent {
      return this._mapComponent;
    }
    public set mapComponent(value: MapComponent) {
      this._mapComponent = value;
    }

    public get patients(): Patient[] {
        return this._patients;
    }
    public set patients(value: Patient[]) {
        this._patients = value;
    }

    public get shouldDisplayPatients(): boolean {
      return this._shouldDisplayPatients;
    }
    public set shouldDisplayPatients(value: boolean) {
      if (this._shouldDisplayPatients == value)
      {
        return;
      }
      this._shouldDisplayPatients = value;

      // if (this._shouldDisplayPatients)
      // {
      //   for (let i = 0; i < this.patients.length; i++)
      //   {
      //     let marker = this.patients[i].marker;
      //     let patient = this.patients[i];
      //     marker.on("click",() =>
      //     {
      //       if (this._shouldDisplayPatients)
      //       {
      //         this.mapComponent.OnPatientMarkerClicked(patient,this);
      //       }
      //       else
      //       {
      //         this.mapComponent.OnClusterClicked.emit({cluster:this})
      //       }
      //     })
      //   }
      // }

      // update what gets displayed
      this.mapComponent.OnZoomChanged(this);


      
    }

    private GetHaversineDistance(point1 : number[], point2 : number[])
    {     
      function toRad(input : number)
      {
        return input * Math.PI / 180;
      }

      var lat2 = point2[0]; 
      var lon2 = point2[1]; 
      var lat1 = point1[0]; 
      var lon1 = point1[1]; 

      var R = 6371.0; // km 
      var x1 = lat2-lat1;
      var dLat = toRad(x1);
      var x2 = lon2-lon1;
      var dLon = toRad(x2); 
      var a = Math.sin(dLat/2.0) * Math.sin(dLat/2.0) + 
                      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
                      Math.sin(dLon/2.0) * Math.sin(dLon/2.0);  
      var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0-a)); 
      var d = R * c; 
      // return value in miles
      return d * 0.6214;
    }

    public CalculateDiameter()
    {
      let farthestDistance = 0.0;

      for (let originIndex = 0; originIndex < this._patients.length;originIndex++)
      {
        for (let destinationIndex = originIndex + 1; destinationIndex < this._patients.length; destinationIndex++)
        {
          let d = this.GetHaversineDistance(this._patients[originIndex].location,this._patients[destinationIndex].location);
          if (d > farthestDistance)
          {
            farthestDistance = d;
          }
  
        }
      }
      if (this._polygon !== undefined)
      {
        this._polygon.setTooltipContent(`${this._patients.length}`);
      }

      this._diameter = Math.round(farthestDistance * 100) / 100;
      
    }

    public get shouldDisplayArea(): boolean {
      return this._shouldDisplayArea;
    }
    public set shouldDisplayArea(value: boolean) {
      if (value == this._shouldDisplayArea)
      {
        return;
      }
      this._shouldDisplayArea = value;
      if (this._shouldDisplayArea)
      {
        if (this._polygon !== undefined)
        {
          try
          {
            Cluster.MappedPolygons.removeLayer(this._polygon as L.Layer);
          }
          catch
          {
    
          }
          this._polygon.addTo(Cluster.MappedPolygons);
        }
        if (this._routePolyline !== undefined)
        {
          try
          {
            Cluster.MappedPolygons.removeLayer(this._routePolyline as L.Layer);
          }
          catch
          {
    
          }
          this._routePolyline.addTo(Cluster.MappedPolygons);
        }
      }
      else
      {
        try
        {
          Cluster.MappedPolygons.removeLayer(this._polygon as L.Layer);
        }
        catch
        {
  
        }
        try
        {
          Cluster.MappedPolygons.removeLayer(this._routePolyline as L.Layer);
        }
        catch
        {
  
        }
      }
    }

    public set hasBeenPartitioned(theHasBeenPartitioned : boolean)
    {
      this._hasBeenPartitioned = theHasBeenPartitioned;
    }

    public get hasBeenPartitioned() : boolean
    {
      return this._hasBeenPartitioned;
    }

    public set leafletMarkerCluster(theMarkerCluster : L.MarkerCluster)
    {
      try
      {
        Cluster.LeafletMarkerClustersGroup.removeLayer(this._leafletMarkerCluster as L.Layer);
      }
      catch
      {

      }
      this._leafletMarkerCluster = theMarkerCluster;
      this._leafletMarkerCluster.addTo(Cluster.LeafletMarkerClustersGroup);
    }

    public get leafletMarkerCluster() : L.MarkerCluster
    {
      return this._leafletMarkerCluster!;
    }

    public set polygon(thePolygon : L.Polygon)
    {
      try
      {
        Cluster.MappedPolygons.removeLayer(this._polygon as L.Layer);
        
      }
      catch
      {

      }
      try
      {
        Cluster.MappedPolygons.removeLayer(this._routePolyline as L.Layer);
      }
      catch
      {

      }
      this._polygon = thePolygon;
      this._polygon.bindTooltip(`${this._patients.length}`,{permanent:true,direction:"center"});
      this._polygon.addTo(Cluster.MappedPolygons);
    }

    public get polygon() : L.Polygon
    {
      return this._polygon!;
    }

    public set shape(theShape : any[])
    {
      this._shape = theShape;
    }

    public get shape() : any[]
    {
      return this._shape!;
    }

    public set color(theColor : string)
    {
      this._color = theColor;
      if (this._polygon && !this._isHighlighted)
      {
        this._polygon.setStyle({color:this._color});
      }
    }

    public get color() : string
    {
      return this._color!;
    }

}

