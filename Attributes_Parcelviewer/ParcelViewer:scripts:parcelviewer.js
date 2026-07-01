const urls = {
  locatorURL:
    "https://maps.nashville.gov/arcgis2/rest/services/Locators/Metro_Comp_Pro/GeocodeServer",
  zipCodesLayer:
    "https://maps.nashville.gov/arcgis/rest/services/Boundaries/Boundaries/MapServer/0",
  overlayDistrictsLayer:
    "https://maps.nashville.gov/arcgis/rest/services/Zoning_Landuse/ZoningOverlayDistricts/MapServer/0",
  councilDistrictsLayer: "https://services2.arcgis.com/HdTo6HJqh92wn4D8/arcgis/rest/services/2022_Council_Districts_(Future)_view/FeatureServer",
  zoningCodesService: "../ParcelService/search.asmx/GetZoningCodes",
  useCodesService: "../ParcelService/search.asmx/GetUseCodes",
  selectParcelsByZoningGP:
    "https://maps.nashville.gov/arcgis/rest/services/Geoprocessing/SelectParcelByZoning/GPServer/SelectParcelsByZoning",
  printURL:
    "https://utility.arcgisonline.com/arcgis/rest/services/Utilities/PrintingTools/GPServer/Export%20Web%20Map%20Task",
  assessProURL:
    "../ParcelService/Search.asmx/GetAssesorAccount?apn=",
  getPinURL:
    "../ParcelService/Search.asmx/GetPin?APN=",
};

require([
  "esri/WebMap",
  "esri/views/MapView",
  "esri/Graphic",
  "esri/Basemap",
  "esri/layers/MapImageLayer",
  "esri/layers/WMTSLayer",
  "esri/layers/FeatureLayer",
  "esri/core/reactiveUtils",
  "esri/rest/geoprocessor",
  "esri/geometry/operators/unionOperator",
  "esri/geometry/support/webMercatorUtils",
  "esri/geometry/coordinateFormatter",
], async (
  WebMap,
  MapView,
  Graphic,
  Basemap,
  MapImageLayer,
  WMTSLayer,
  FeatureLayer,
  reactiveUtils,
  geoprocessor,
  unionOperator,
  webMercatorUtils,
  coordinateFormatter,
) => {

  getSelectLists();

  let map = new WebMap({
    portalItem: {
      id: "26100197ef524cb5a2077b8452e321a8",
    },
    basemap: "gray-vector",
  });

  let parcelsLayer = new FeatureLayer({
    url: "https://maps.nashville.gov/arcgis/rest/services/Cadastral/Parcels/MapServer/0",
    title: "Parcels Layer",
    minScale: 10000,
    maxScale: 0,
    opacity: 0,
    listMode: "hide",
    legendEnabled: false,
  });

  const view = new MapView({
    container: "viewDiv",
    map: map,
    zoom: 10,
    center: [-86.7816, 36.1627],
    constraints: {
      minZoom: 8,
    },
  });

  let config = loadConfig();

  await setupViewUI(view, map);
  map.when(() => {
    addBasemapsToMap(config, view);
    map.add(parcelsLayer);

    map.layers.forEach((layer) => {
      view
        .whenLayerView(layer)
        .then(() => {
        })
        .catch(() => {
          console.warn(
            `Failed to load layer: ${layer.title || layer.id || layer.url}`
          );
        });
    });

    let urlParams = new URLSearchParams(window.location.search);
    let parcelID = urlParams.get("parcelID") || "";
    if (parcelID != "") {
      document.getElementById("txtParcel").value = parcelID;
      search("searchParcelButton", parcelsLayer, view, config);
      hideSplashScreen();
    }
  });

  setupPopup(view, parcelsLayer);

  document.getElementById("logo").addEventListener("click", () => {
    window.open("https://maps.nashville.gov");
  });

  let layerList = document.getElementById("layerList");
  layerList.view = view;

  //we use a search component instead of a widget, as the widgets will soon be deprecated
  let searchComponent = document.getElementById("searchComponent");
  searchComponent.view = view;
  searchComponent.sources = [
    {
      name: "NashCompLocator",
      url: urls.locatorURL,
      outFields: ["Match_addr", "Loc_Name"],
      singleLineFieldName: "SingleLine",
      placeholder: "Ex: 700 PRESIDENT RONALD REAGAN WAY, NASHVILLE, TN, 37210"
    },
  ];
  searchComponent.includeDefaultSourcesDisabled = true;

  searchComponent.addEventListener("arcgisSelectResult", (event) => {
    parcelLocate(event, parcelsLayer, view, config);
  });

  let searchButtons = document.getElementsByClassName("searchButton");
  Array.from(searchButtons).forEach((button) => {
    button.addEventListener("click", (evt) => {
      search(evt.target.id, parcelsLayer, view, config);
    });
  });

  document.getElementById("txtParcel").addEventListener("keydown", (e) => {
    if (e.key === "Enter")
      document.getElementById("searchParcelButton").click();
  });
  document.getElementById("txtOwner").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("searchOwnerButton").click();
  });
  document.getElementById("txtStreet").addEventListener("keydown", (e) => {
    if (e.key === "Enter")
      document.getElementById("searchStreetButton").click();
  });

  document.getElementById("btnZoomSelected").onclick = () => {
    zoomSelected(view);
  };

  function addBasemapsToMap(config, view) {
    //add basemaps from config
    let basemapComponent = document.getElementById("basemapComponent");
    basemapComponent.view = view;

    let basemaps = [];

    basemaps.push(Basemap.fromId("gray-vector"));

    config.Basemaps.forEach((b) => {
      let basemap = new Basemap({
        baseLayers: [
          b.WMTS
            ? new WMTSLayer({
              title: b.Layer,
              url: b.LayerURL,
              activeLayer: {
                id: b.ActiveSubLayer,
              },
            })
            : new MapImageLayer({
              title: b.Layer,
              url: b.LayerURL,
            }),
        ],
        title: b.Layer,
        thumbnailUrl: b.Thumbnail,
      });
      basemaps.push(basemap);
    });

    basemapComponent.source = basemaps;
  }

  async function setupViewUI(view, map) {
    if (await isAndroid()) {
      let searchDialog = document.getElementById("searchDialog");
      let androidSearchDialogBody = document.getElementById("androidSearchDialogBody");

      Array.from(searchDialog.children).forEach((child) => {
        androidSearchDialogBody.appendChild(child);
      });

      searchDialog.style.display = "none";
      androidSearchDialog = document.getElementById("androidSearchDialog");
      androidSearchDialog.style.display = "none";

      document.getElementById("androidSearchClose").addEventListener("click", () => {
        document.getElementById("btnSearchHeader").active = false;
        document.getElementById("btnSearchMobile").active = false;
        if (sketch) {
          sketch.style.display = "none";
        }
        sketch.layer.removeAll();
        androidSearchDialog.style.display = "none";
      });
    }

    let leftPaneCollapse = document.getElementById("leftPaneCollapse");
    leftPaneCollapse.addEventListener("click", (evt) => {
      toggleLeftPanel();
    });

    window.onload = () => {
      if (window.innerWidth <= 600) {
        toggleLeftPanel();
        leftPaneCollapse.iconStart = "chevrons-up";
      }
    }

    window.addEventListener("resize", () => {
      const rootFontSize = parseFloat(
        getComputedStyle(document.documentElement).fontSize
      );
      ["searchDialog", "streetviewDialog", "coordinatesDialog"].forEach((dialogId) => {
        const dialog = document.getElementById(dialogId);
        if (innerWidth <= 35 * rootFontSize) {
          dialog.resizable = false;
          dialog.dragEnabled = false;
          if (dialog.shadowRoot) {
            let shadowRoot = dialog.shadowRoot;
            let container = shadowRoot.querySelector(".container");
            container.style.height = "40%";
            container.style.top = "60%";
          }
        } else {
          dialog.resizable = true;
          dialog.dragEnabled = true;
          if (dialog.shadowRoot) {
            let shadowRoot = dialog.shadowRoot;
            let container = shadowRoot.querySelector(".container");
            container.style.height = "";
            container.style.top = "";
          }
        }
      });

      if (window.innerWidth <= 600) {
        if (leftPane.style.display != "none") {
          leftPaneCollapse.iconStart = "chevrons-down";
        } else {
          leftPaneCollapse.iconStart = "chevrons-up";
        }

        view.ui.move("sketch", "top-left");
      } else {
        if (leftPane.style.display != "none") {
          leftPaneCollapse.iconStart = "chevrons-left";
        } else {
          leftPaneCollapse.iconStart = "chevrons-right";
        }

        view.ui.move("sketch", "bottom-right");
      }

      let mobileToolbar = document.getElementById("mobileToolbar");

      if (window.innerWidth <= 900) {
        mobileToolbar.style.display = "inline-flex";
        headerRight.style.display = "none";
        headerRightMobile.style.display = "flex";
      } else {
        mobileToolbar.style.display = "none";
        headerRight.style.display = "flex";
        headerRightMobile.style.display = "none";
      }
    });

    let homeButton = document.getElementById("btnHome");
    homeButton.addEventListener("click", () => {
      view.goTo({
        target: [-86.7816, 36.1627],
        zoom: 12,
      });
    });

    let legend = document.createElement("arcgis-legend");
    legend.id = "legend";
    legend.view = view;
    legend.tabIndex = 0;

    view.ui.add(legend, "bottom-left");

    let distanceMeasurement = document.createElement(
      "arcgis-distance-measurement-2d"
    );
    distanceMeasurement.id = "distanceMeasurement";
    distanceMeasurement.view = view;
    distanceMeasurement.unit = "miles";
    distanceMeasurement.style.display = "none";

    let areaMeasurement = document.createElement("arcgis-area-measurement-2d");
    areaMeasurement.id = "areaMeasurement";
    areaMeasurement.view = view;
    areaMeasurement.unit = "acres";
    areaMeasurement.style.display = "none";

    view.ui.add(areaMeasurement, "bottom-right");
    view.ui.add(distanceMeasurement, "bottom-right");

    let leftToolbar = document.getElementById("leftToolbar");
    view.ui.add(leftToolbar, "top-left");

    leftToolbar.addEventListener("click", (evt) => {
      toggleButtonVis(evt.target);
    });

    let headerRight = document.getElementById("headerRight");

    headerRight.addEventListener("click", (evt) => {
      toggleButtonVis(evt.target);
    });

    let headerRightMobile = document.getElementById("headerRightMobile");

    headerRightMobile.addEventListener("click", (evt) => {
      toggleButtonVis(evt.target);
    })

    let mobileToolbar = document.getElementById("mobileToolbar");
    view.ui.add(mobileToolbar, "top-right");

    if (window.innerWidth <= 900) {
      mobileToolbar.style.display = "inline-flex";
      headerRight.style.display = "none";
      headerRightMobile.style.display = "flex";
    } else {
      mobileToolbar.style.display = "none";
      headerRight.style.display = "flex";
      headerRightMobile.style.display = "none";
    }

    mobileToolbar.addEventListener("click", (evt) => {
      toggleButtonVis(evt.target);
    });


    view.ui.move("zoom", "top-right");

    let sketch = document.createElement("arcgis-sketch");
    sketch.id = "sketch";
    sketch.view = view;
    sketch.creationMode = "update";
    sketch.scale = "s";
    sketch.hideSelectionToolsLassoSelection = true;
    sketch.hideSelectionToolsRectangleSelection = true;
    sketch.style.display = "none";

    if (window.innerWidth <= 600) {
      view.ui.add(sketch, "top-left");
    } else {
      view.ui.add(sketch, "bottom-right");
    }

    map.layers.on("after-add", () => {
      view.map.layers.forEach((layer) => {
        if (layer.title == "Sketch Layer") {
          layer.listMode = "hide";
        }
      });
    });

    view.when(() => {
      document
        .getElementById("searchTabsNav")
        .addEventListener("calciteTabChange", (evt) => {
          if (evt.target.selectedTitle.id == "shapeTabTitle") {
            sketch.style.display = "block";
            sketch.layer.visible = true;
            if (window.innerWidth <= 900) {
              sketch.layout = "vertical";
            } else {
              sketch.layout = "horizontal";
            }
          } else {
            sketch.style.display = "none";
            sketch.layer.visible = false;
          }
        });
    });

    ["btnClearGraphicsHeader", "btnClearGraphicsMobile"].forEach((id) => {
      document.getElementById(id).addEventListener("click", () => {
        clearSelection(view, sketch.layer);
      });
    });

    let cameraMode = false;
    let cameraClickHandle = null;

    const handleCamera = () => {
      cameraMode = !cameraMode;

      view.container.style.cursor = cameraMode ? "crosshair" : "default";

      if (cameraMode) {
        cameraClickHandle = view.on("click", (e) => {
          if (document.getElementById("segControlStreetview").checked) {
            let url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${e.mapPoint.latitude.toFixed(5)},${e.mapPoint.longitude.toFixed(5)}`
            window.open(
              url
            );
          }
          else {
            window.open(
              `https://portal.patriotproperties.com/?APIKEY=5D050659143EB96630FB38B91DE12E40&SECRETKEY=A92169630C9BC3C00A1C0F9F140E6DAEC21C8E62DCFF9FC443FB1BE70DDF6AA4268527B9DDE2ECC2C7EE9BB5BF728C06F0DF4019BBECDEBD2A6DD0BBE28A419D8F929E1F3E8DF478E56619995BEFCA8E369276689D791197DC1284F14B3252DBFB2A19A2E451EEA832D6D96488DDC673EBA4B37BD741223B656A793D93209C0F&LAT=${e.mapPoint.latitude.toFixed(5)}&LONG=${e.mapPoint.longitude.toFixed(5)}`
            );
          }
        });
      } else {
        if (cameraClickHandle) {
          cameraClickHandle.remove();
          cameraClickHandle = null;
        }
      }
    }

    ["btnCameraHeader", "btnCameraMobile"].forEach((id) => {
      document.getElementById(id).addEventListener("click", () => {
        //if we are disabling the camera by toggling the button off, no need to call handlecamera here, as it is called by the dialog close event
        if (document.getElementById(id).active == false) {
          handleCamera();
        }
      });
    });

    document.getElementById("printComponent").view = view;

    let coordinatesMode = false;
    let coordinatesClickHandle = null;

    const handleCoordinates = () => {
      coordinatesMode = !coordinatesMode;

      view.container.style.cursor = coordinatesMode ? "crosshair" : "default";

      if (coordinatesMode) {
        coordinatesClickHandle = view.on("click", (e) => {
          coordinateFormatter.load().then(() => {
            const geographicPoint = webMercatorUtils.webMercatorToGeographic(e.mapPoint);
            let coords = coordinateFormatter.toLatitudeLongitude(
              geographicPoint
              , "dms", 3);

            //improve text formatting
            let coordsParts = coords.split(" ");
            let newCoords = `${coordsParts[0]}°${coordsParts[1]}'${coordsParts[2]}, ${coordsParts[3]}°${coordsParts[4]}'${coordsParts[5]}`;
            newCoords = newCoords.replace('N', '"N').replace('S', '"S').replace('E', '"E').replace('W', '"W');

            document.getElementById("coordinatesText").textContent = newCoords;
          });

        });
      } else {
        if (coordinatesClickHandle) {
          coordinatesClickHandle.remove();
          coordinatesClickHandle = null;
        }
      }
    }

    ["btnCoordinatesHeader", "btnCoordinatesMobile"].forEach((id) => {
      document.getElementById(id).addEventListener("click", () => {
        if (document.getElementById(id).active == false) {
          handleCoordinates();
        }
      });
    });

    ["searchDialog", "streetviewDialog", "coordinatesDialog"].forEach((dialogId) => {
      document
        .getElementById(dialogId)
        .addEventListener("calciteDialogBeforeOpen", (evt) => {
          //1 rem
          const rootFontSize = parseFloat(
            getComputedStyle(document.documentElement).fontSize
          );
          if (innerWidth <= 35 * rootFontSize) {
            evt.target.resizable = false;
            evt.target.dragEnabled = false;
            if (evt.target.shadowRoot) {
              let shadowRoot = evt.target.shadowRoot;
              let container = shadowRoot.querySelector(".container");
              container.style.height = "40%";
              container.style.top = "60%";
            }
          } else {
            if (evt.target.shadowRoot) {
              let shadowRoot = evt.target.shadowRoot;
              let container = shadowRoot.querySelector(".container");
              container.style.height = "";
              container.style.top = "";
            }
          }
          if (
            document.getElementById("searchTabsNav").selectedTitle.id ==
            "shapeTabTitle"
          ) {
            sketch.style.display = "block";
          }
        });
    });

    document
      .getElementById("searchDialog")
      .addEventListener("calciteDialogBeforeClose", () => {
        document.getElementById("btnSearchHeader").active = false;
        document.getElementById("btnSearchMobile").active = false;
        if (sketch) {
          sketch.style.display = "none";
        }
        sketch.layer.removeAll();
        document.getElementById("androidSearchDialog").style.display = "none";
      });
    document
      .getElementById("basemapDialog")
      .addEventListener("calciteDialogBeforeClose", () => {
        document.getElementById("btnBasemapHeader").active = false;
        document.getElementById("btnBasemapMobile").active = false;
      });
    document
      .getElementById("layerlistDialog")
      .addEventListener("calciteDialogBeforeClose", () => {
        document.getElementById("btnLayersHeader").active = false;
        document.getElementById("btnLayersMobile").active = false;
      });
    document
      .getElementById("streetviewDialog")
      .addEventListener("calciteDialogBeforeClose", () => {
        handleCamera();
        document.getElementById("btnCameraHeader").active = false;
        document.getElementById("btnCameraMobile").active = false;
      });
    document
      .getElementById("printDialog")
      .addEventListener("calciteDialogBeforeClose", () => {
        document.getElementById("btnPrintMapHeader").active = false;
        document.getElementById("btnPrintMapMobile").active = false;
      });
    document
      .getElementById("printDialog")
      .addEventListener("calciteDialogBeforeClose", () => {
        document.getElementById("btnPrintMapHeader").active = false;
        document.getElementById("btnPrintMapMobile").active = false;
      });
    document
      .getElementById("coordinatesDialog")
      .addEventListener("calciteDialogBeforeClose", () => {
        handleCoordinates();
        document.getElementById("btnCoordinatesHeader").active = false;
        document.getElementById("btnCoordinatesMobile").active = false;
      });
    document
      .getElementById("contactUsDialog")
      .addEventListener("calciteDialogBeforeClose", () => {
        document.getElementById("btnContactUsHeader").active = false;
        document.getElementById("btnContactUs").active = false;
      });

    //Prevent arrows from dragging the dialog when focus is inside a select element
    const onDialogKeydownCapture = (e) => {
      const arrows = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
      if (!arrows.includes(e.key)) return;

      const active = document.activeElement;
      if (!active) return;

      const insideSelect =
        (active.classList && active.classList.contains("searchDialogSelect")) ||
        (active.tagName === "OPTION" &&
          active.parentElement &&
          active.parentElement.classList &&
          active.parentElement.classList.contains("searchDialogSelect")) ||
        (active.closest &&
          active.closest(".searchDialogSelect") !== null);

      if (insideSelect) {
        e.stopPropagation();
      }
    };

    document.addEventListener("keydown", onDialogKeydownCapture, true);
  }

  async function setupPopup(view, parcelsLayer) {
    let fieldInfos = [
      {
        fieldName: "APN",
        label: "Parcel ID:",
      },
      {
        fieldName: "PropAddr",
        label: "Parcel Address:",
      },
      {
        fieldName: "Owner",
        label: "Owner:",
      },
    ];

    parcelsLayer.popupTemplate = {
      title: "{APN}",
      content: [
        {
          type: "fields",
          fieldInfos: fieldInfos,
        },
      ],
      actions: [
        {
          title: "View Parcel Details",
          id: "viewParcelDetails",
          className: "esri-icon-review",
        },
        {
          title: "Print Parcel Details",
          id: "printParcelInfo",
          className: "esri-icon-printer",
        },
        {
          title: "View Imagery",
          id: "viewImagery",
          className: "esri-icon-public",
        },
        {
          title: "Open in Street View",
          id: "streetView",
          className: "esri-icon-user",
        },
      ],
    };

    reactiveUtils.on(
      () => view.popup,
      "trigger-action",
      async (event) => {
        try {
          const apn = view.popup.selectedFeature.attributes["APN"];
          let tempWin = null;
          const willOpenRemote = ["printParcelInfo", "viewImagery", "streetView"].includes(event.action.id);
          if (willOpenRemote) {
            tempWin = window.open("", "_blank");
            if (!tempWin) {
              alert("Pop-up blocked. Please allow pop-ups for this site.");
              return;
            }
          }

          let pin = "";
          if (["printParcelInfo", "viewParcelDetails"].includes(event.action.id)) {
            if (!apn) {
              alert("No APN available.");
              if (tempWin) tempWin.close();
              return;
            }
            const pinURL = urls.getPinURL + apn;
            const xml = await getXML(pinURL);
            if (!xml) {
              alert("Error retrieving PIN from service");
              if (tempWin) tempWin.close();
              return;
            }
            const pinElement = xml.getElementsByTagName("PIN")[0];
            pin = pinElement ? pinElement.textContent.trim() : "";
          }

          if (event.action.id === "viewParcelDetails") {
            loadParcelDetails(apn, pin, config.WebServices, config.ParcelFields, parcelsLayer);
            return;
          }

          if (event.action.id === "printParcelInfo") {
            if (pin != "") {
              const url = "./PrintRecord.html?pin=" + pin;
              tempWin.location.href = url;
            } else {
              alert("No Parcel Selected");
              if (tempWin) tempWin.close();
            }
            return;
          }

          if (event.action.id === "viewImagery") {
            const lat = view.popup.selectedFeature.geometry.centroid.latitude;
            const lon = view.popup.selectedFeature.geometry.centroid.longitude;
            const url = `https://portal.patriotproperties.com/?APIKEY=5D050659143EB96630FB38B91DE12E40&SECRETKEY=A92169630C9BC3C00A1C0F9F140E6DAEC21C8E62DCFF9FC443FB1BE70DDF6AA4268527B9DDE2ECC2C7EE9BB5BF728C06F0DF4019BBECDEBD2A6DD0BBE28A419D8F929E1F3E8DF478E56619995BEFCA8E369276689D791197DC1284F14B3252DBFB2A19A2E451EEA832D6D96488DDC673EBA4B37BD741223B656A793D93209C0F&LAT=${lat}&LONG=${lon}`;
            if (tempWin) {
              tempWin.location.href = url;
            } else {
              // fallback synchronous anchor click
              const a = document.createElement("a");
              a.href = url;
              a.target = "_blank";
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }
            return;
          }

          if (event.action.id === "streetView") {
            const lat = view.popup.selectedFeature.geometry.centroid.latitude.toFixed(5);
            const lon = view.popup.selectedFeature.geometry.centroid.longitude.toFixed(5);
            const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;
            if (tempWin) {
              tempWin.location.href = url;
            } else {
              const a = document.createElement("a");
              a.href = url;
              a.target = "_blank";
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }
            return;
          }
        } catch (e) {
          alert(e);
        }
      }
    );
  }

  function clearSelection(view, sketchLayer) {
    view.graphics.removeAll();
    sketchLayer.removeAll();

    if (document.getElementById("grid")) {
      document.getElementById("grid").remove();
    }

    document.getElementById("searchTabs").style.display = "flex";
    document.getElementById("resultsParentDiv").style.display = "none";
  }

  function getSelectLists() {
    let zipCodesLayer = new FeatureLayer({
      url: urls.zipCodesLayer,
    });

    let zcQuery = zipCodesLayer.createQuery();
    zcQuery.returnGeometry = false;
    zcQuery.outFields = ["ZipCode"];
    zcQuery.where = "ZipCode is not null";
    zcQuery.orderByFields = ["ZipCode"];
    zcQuery.returnDistinctValues = true;

    zipCodesLayer.queryFeatures(zcQuery).then((results) => {
      let selectZip = document.getElementById("selectZip");
      results.features.forEach((feature) => {
        let opData = document.createElement("option");
        opData.text = feature.attributes["ZipCode"];
        opData.value = feature.attributes["ZipCode"];
        selectZip.appendChild(opData);
      });
    });

    let poQuery = zipCodesLayer.createQuery();
    poQuery.returnGeometry = false;
    poQuery.outFields = ["POName"];
    poQuery.where = "POName is not null";
    poQuery.orderByFields = ["POName"];
    poQuery.returnDistinctValues = true;

    zipCodesLayer.queryFeatures(poQuery).then((results) => {
      let selectCity = document.getElementById("selectCity");
      results.features.forEach((feature) => {
        let opData = document.createElement("option");
        opData.text = feature.attributes["POName"];
        opData.value = feature.attributes["POName"];
        selectCity.appendChild(opData);
      });
    });

    let selectTax = document.getElementById("selectTax");
    let myData = [
      { label: "Urban Services District", value: "USD" },
      { label: "General Services District", value: "GSD" },
      { label: "Central Business Improvement District", value: "CBID" },
      { label: "Gulch Business Improvement District", value: "GBID" },
      { label: "Bellemeade", value: "BM" },
      { label: "Berry Hill", value: "BH" },
      { label: "Forest Hills", value: "FH" },
      { label: "Goodlettsville", value: "GO" },
      { label: "Oak Hill", value: "OH" },
      { label: "Ridgetop", value: "RT" },
    ];

    for (let itm in myData) {
      let opData = document.createElement("option");
      opData.text = myData[itm].label;
      opData.value = myData[itm].value;
      selectTax.appendChild(opData);
    }

    let overlayDistrictsLayer = new FeatureLayer({
      url: urls.overlayDistrictsLayer,
    });

    let odQuery = overlayDistrictsLayer.createQuery();
    odQuery.returnGeometry = false;
    odQuery.outFields = ["ZONE_DESC"];
    odQuery.where = "ZONE_DESC is not null";
    odQuery.orderByFields = ["ZONE_DESC"];
    odQuery.returnDistinctValues = true;

    overlayDistrictsLayer.queryFeatures(odQuery).then((results) => {
      let selectOverlays = document.getElementById("selectOverlays");
      results.features.forEach((feature) => {
        let opData = document.createElement("option");
        opData.text = feature.attributes["ZONE_DESC"];
        opData.value = feature.attributes["ZONE_DESC"];
        selectOverlays.appendChild(opData);
      });
      let opData = document.createElement("option");
      opData.text = "Planned Unit Development";
      opData.value = "Planned Unit Development";
      selectOverlays.appendChild(opData);
    });

    let councilDistrictsLayer = new FeatureLayer({
      url: urls.councilDistrictsLayer,
    });

    let cdQuery = councilDistrictsLayer.createQuery();
    cdQuery.returnGeometry = false;
    cdQuery.outFields = ["DistrictName", "DISTRICT"];
    cdQuery.where = "DistrictName is not null";
    cdQuery.orderByFields = ["DISTRICT"];
    cdQuery.returnDistinctValues = true;

    councilDistrictsLayer.queryFeatures(cdQuery).then((results) => {
      let selectCouncil = document.getElementById("selectCouncil");
      results.features.forEach((feature) => {
        let opData = document.createElement("option");
        opData.text = feature.attributes["DistrictName"];
        opData.value = String(feature.attributes["DISTRICT"]).padStart(2, '0');
        selectCouncil.appendChild(opData);
      });
    });

    let selectZoning = document.getElementById("selectZoning");
    getXML(urls.zoningCodesService).then((xml) => {
      let records = xml.getElementsByTagName("anyType");
      Array.from(records).forEach((record) => {
        let opData = document.createElement("option");
        opData.text =
          record.getElementsByTagName("Zone")[0].textContent +
          ": " +
          record.getElementsByTagName("ZoneDescription")[0].textContent;
        opData.value = record.getElementsByTagName("Zone")[0].textContent;
        selectZoning.appendChild(opData);
      });
    });

    let selectUse = document.getElementById("selectUse");
    getXML(urls.useCodesService).then((xml) => {
      let records = xml.getElementsByTagName("anyType");
      Array.from(records).forEach((record) => {
        let opData = document.createElement("option");
        opData.text = record.getElementsByTagName("UseDescription")[0].textContent;
        opData.value = record.getElementsByTagName("UseCode")[0].textContent;
        selectUse.appendChild(opData);
      });
    });
  }

  function parcelLocate(evt, parcelsLayer, view, config) {
    if (document.getElementById("grid")) {
      document.getElementById("grid").remove();
    }

    if (evt.detail.result.feature.geometry != undefined) {
      let geometry = evt.detail.result.feature.geometry;

      let symbol = {
        type: "simple-marker",
        color: [88, 116, 152, 0.45],
        size: 20,
        style: "diamond",
        outline: {
          color: [88, 116, 152],
          width: 2,
        },
      };

      let query = parcelsLayer.createQuery();
      query.returnGeometry = true;
      query.outFields = ["*"];
      query.geometry = geometry;

      parcelsLayer.queryFeatures(query).then(function (results) {
        if (results.features.length > 0) {
          view.graphics.removeAll();
          document.getElementById("recCount").innerHTML = "1 Record found.";

          let feature = results.features[0];

          let graphic = new Graphic({
            symbol: {
              type: "simple-fill",
              color: [255, 0, 0, 0.5],
              outline: null,
            },
            geometry: feature.geometry,
            attributes: feature.attributes,
          });
          view.graphics.add(graphic);

          showResults(results.features, config, parcelsLayer, view);
          exportExcel(results.features);
        } else {
          if (document.getElementById("grid")) {
            document.getElementById("grid").remove();
          }
          let graphic = {
            symbol: symbol,
            geometry: geometry,
          };
          view.graphics.add(graphic);
          document.getElementById("recCount").innerHTML =
            "No parcels found with that address.";
        }
      });
    } else {
      alert("Could not find address or location!");
    }
  }

  function search(targetID, parcelsLayer, view, config) {
    let query = parcelsLayer.createQuery();
    query.returnGeometry = true;
    query.outFields = ["*"];

    if (
      targetID != "searchCustomButton" &&
      targetID != "resetCustom" &&
      targetID != "searchShapeButton"
    ) {
      if (targetID == "searchParcelButton") {
        let apn = document.getElementById("txtParcel");
        let val = apn.value;
        if (val != "") {
          showLoading();
          query.where = "APN like '" + val.toUpperCase() + "%'";
        } else {
          alert("You must enter search criteria!");
          return;
        }
      } else if (targetID == "searchOwnerButton") {
        let owner = document.getElementById("txtOwner");
        let val = owner.value;
        if (val != "") {
          showLoading();
          query.where =
            "Owner like '" + val.toUpperCase().replace("'", "''") + "%'";
        } else {
          alert("You must enter search criteria!");
          return;
        }
      } else if (targetID == "searchStreetButton") {
        let street = document.getElementById("txtStreet");
        let val = street.value;
        if (val != "") {
          showLoading();
          query.where =
            "PropAddr like '%" + val.toUpperCase().replace("'", "''") + "%'";
        } else {
          alert("You must enter search criteria!");
          return;
        }
      }

      parcelsLayer.queryFeatures(query).then(function (results) {
        if (results.exceededTransferLimit) {
          alert(
            "More than 4000 records meet the search criteria, only 4000 have been returned.  Please adjust search criteria."
          );
          document.getElementById("recCount").innerHTML =
            "More than " +
            results.features.length.toString() +
            " Record(s) found.";
        } else {
          document.getElementById("recCount").innerHTML =
            results.features.length.toString() + " Record(s) found.";
        }
        let featureSet = results.features;
        if (featureSet.length == 1) {
          let feature = featureSet[0];
          view.graphics.removeAll();
          let graphic = new Graphic({
            symbol: {
              type: "simple-fill",
              color: [255, 0, 0, 0.5],
              outline: null,
            },
            geometry: feature.geometry,
            attributes: feature.attributes,
          });
          view.graphics.add(graphic);

          showResults(featureSet, config, parcelsLayer, view);
          exportExcel(featureSet);
        } else {
          view.graphics.removeAll();
          let resultsGeometries = featureSet.map((f) => f.geometry);
          if (resultsGeometries.length > 0) {
            let mergedGeometry = unionOperator.executeMany(resultsGeometries);
            let graphic = new Graphic({
              symbol: {
                type: "simple-fill",
                color: [255, 0, 0, 0.5],
                outline: null,
              },
              geometry: mergedGeometry,
            });
            view.graphics.add(graphic);
          }

          showResults(featureSet, config, parcelsLayer, view);
          exportExcel(featureSet);
        }
      });
    } else if (targetID == "searchCustomButton") {
      showLoading();

      let sWhere = "";

      let txtParcel2 = document.getElementById("txtParcel2").value;
      if (txtParcel2 != "") {
        let txtParcel2Where = txtParcel2
          .toUpperCase()
          .replace("%", "")
          .replace("'", "''");
        sWhere = "APN like '" + txtParcel2Where + "%'";
      }

      let txtOwner2 = document.getElementById("txtOwner2").value;
      if (txtOwner2 != "") {
        let txtOwner2Where = txtOwner2
          .toUpperCase()
          .replace("%", "")
          .replace("'", "''");
        sWhere == ""
          ? (sWhere = "Owner like '" + txtOwner2Where + "%'")
          : (sWhere += " and Owner like '" + txtOwner2Where + "%'");
      }

      let txtStreet = document.getElementById("txtStreet2").value;
      if (txtStreet != "") {
        let txtStreetWhere = txtStreet
          .toUpperCase()
          .replace("%", "")
          .replace("'", "''");
        sWhere == ""
          ? (sWhere = "PropStreet like '" + txtStreetWhere + "%'")
          : (sWhere += " and PropStreet like '" + txtStreetWhere + "%'");
      }

      let szList = "";
      let szSelectBox = document.getElementById("selectZip");
      for (let i = 0; i < szSelectBox.options.length; i++) {
        if (szSelectBox.options[i].selected) {
          if (szList == "") {
            szList = "'" + szSelectBox.options[i].value + "'";
          } else {
            szList = szList + ",'" + szSelectBox.options[i].value + "'";
          }
        }
      }

      if (szList != "") {
        sWhere == ""
          ? (sWhere = "PropZip in (" + szList + ")")
          : (sWhere = sWhere + " and PropZip in (" + szList + ")");
      }

      let txtDesc2 = document.getElementById("txtDesc2").value;
      if (txtDesc2 != "") {
        let txtDesc2Where = txtDesc2
          .toUpperCase()
          .replace("%", "")
          .replace("'", "''");
        sWhere == ""
          ? (sWhere = "LegalDesc like '" + txtDesc2Where + "%'")
          : (sWhere += " and LegalDesc like '" + txtDesc2Where + "%'");
      }

      let txtAcreMin = document.getElementById("txtAcreMin").value;
      if (txtAcreMin != "") {
        if (!isNaN(parseFloat(txtAcreMin))) {
          sWhere == ""
            ? (sWhere = "Acres >= " + txtAcreMin)
            : (sWhere += " and Acres >= " + txtAcreMin);
        }
      }

      let txtAcreMax = document.getElementById("txtAcreMax").value;
      if (txtAcreMax != "") {
        if (!isNaN(parseFloat(txtAcreMax))) {
          sWhere == ""
            ? (sWhere = "Acres <= " + txtAcreMax)
            : (sWhere += " and Acres <= " + txtAcreMax);
        }
      }

      let txtSaleDateMin = document.getElementById("txtSaleDateMin").value;
      if (isDate(txtSaleDateMin)) {
        sWhere == ""
          ? (sWhere = "OwnDate >= '" + txtSaleDateMin + "'")
          : (sWhere += " and OwnDate >= '" + txtSaleDateMin + "'");
      }

      let txtSaleDateMax = document.getElementById("txtSaleDateMax").value;
      if (isDate(txtSaleDateMax)) {
        sWhere == ""
          ? (sWhere = "OwnDate <= '" + txtSaleDateMax + "'")
          : (sWhere += " and OwnDate <= '" + txtSaleDateMax + "'");
      }

      let txtSalePriceMin = document.getElementById("txtSalePriceMin").value;
      if (txtSalePriceMin != "") {
        if (!isNaN(parseFloat(txtSalePriceMin))) {
          sWhere == ""
            ? (sWhere = "SalePrice >= " + txtSalePriceMin)
            : (sWhere += " and SalePrice >= " + txtSalePriceMin);
        }
      }

      let txtSalePriceMax = document.getElementById("txtSalePriceMax").value;
      if (txtSalePriceMax != "") {
        if (!isNaN(parseFloat(txtSalePriceMax))) {
          sWhere == ""
            ? (sWhere = "SalePrice <= " + txtSalePriceMax)
            : (sWhere += " and SalePrice <= " + txtSalePriceMax);
        }
      }

      let stList = "";
      let stSelectBox = document.getElementById("selectTax");
      for (let i = 0; i < stSelectBox.options.length; i++) {
        if (stSelectBox.options[i].selected) {
          if (stList == "") {
            stList = "'" + stSelectBox.options[i].value + "'";
          } else {
            stList = stList + ",'" + stSelectBox.options[i].value + "'";
          }
        }
      }

      if (stList != "") {
        if (sWhere == "") {
          sWhere = "TaxDist in (" + stList + ")";
        } else {
          sWhere = sWhere + " and TaxDist in (" + stList + ")";
        }
      }

      let suList = "";
      let suSelectBox = document.getElementById("selectUse");
      for (let i = 0; i < suSelectBox.options.length; i++) {
        if (suSelectBox.options[i].selected) {
          if (suList == "") {
            suList = "'" + suSelectBox.options[i].value + "'";
          } else {
            suList = suList + ",'" + suSelectBox.options[i].value + "'";
          }
        }
      }

      if (suList != "") {
        if (sWhere == "") {
          sWhere = "LUCode in (" + suList + ")";
        } else {
          sWhere = sWhere + " and LUCode in (" + suList + ")";
        }
      }

      let scList = "";
      let scSelectBox = document.getElementById("selectCity");
      for (let i = 0; i < scSelectBox.options.length; i++) {
        if (scSelectBox.options[i].selected) {
          if (scList == "") {
            scList = "'" + scSelectBox.options[i].value.toUpperCase() + "'";
          } else {
            scList =
              scList + ",'" + scSelectBox.options[i].value.toUpperCase() + "'";
          }
        }
      }

      if (scList != "") {
        if (sWhere == "") {
          sWhere = "PropCity in (" + scList + ")";
        } else {
          sWhere = sWhere + " and PropCity in (" + scList + ")";
        }
      }

      let sCouncilList = "";
      let sCouncilSelectBox = document.getElementById("selectCouncil");
      for (let i = 0; i < sCouncilSelectBox.options.length; i++) {
        if (sCouncilSelectBox.options[i].selected) {
          if (sCouncilList == "") {
            sCouncilList =
              "'" + sCouncilSelectBox.options[i].value.toUpperCase() + "'";
          } else {
            sCouncilList =
              sCouncilList +
              ",'" +
              sCouncilSelectBox.options[i].value.toUpperCase() +
              "'";
          }
        }
      }

      if (sCouncilList != "") {
        if (sWhere == "") {
          sWhere = "Council in (" + sCouncilList + ")";
        } else {
          sWhere = sWhere + " and Council in (" + sCouncilList + ")";
        }
      }

      let zonelst = "";
      let zoningSelectBox = document.getElementById("selectZoning");

      for (let i = 0; i < zoningSelectBox.options.length; i++) {
        if (zoningSelectBox.options[i].selected) {
          if (zonelst == "") {
            zonelst = zoningSelectBox.options[i].value;
          } else {
            zonelst = zonelst + "," + zoningSelectBox.options[i].value;
          }
        }
      }

      let overlaylst = "";
      let selectbox = document.getElementById("selectOverlays");
      let pud = false;
      for (let i = 0; i < selectbox.options.length; i++) {
        if (selectbox.options[i].selected) {
          if (selectbox.options[i].value == "Planned Unit Development") {
            pud = true;
          }
          if (overlaylst == "") {
            if (!pud) {
              overlaylst = selectbox.options[i].value;
            }
          } else {
            if (!pud) {
              overlaylst = overlaylst + "," + selectbox.options[i].value;
            }
          }
        }
      }

      if (pud && overlaylst != "") {
        overlaylst = overlaylst + ",Planned Unit Development";
      } else if (pud && overlaylst == "") {
        overlaylst = "Planned Unit Development";
      }

      if (zonelst != "" || overlaylst != "") {
        view.graphics.removeAll();

        let params = {
          ParcelExpression: sWhere,
          ZoningExpression: zonelst,
          OverlayExpression: overlaylst,
        };

        geoprocessor
          .execute(urls.selectParcelsByZoningGP, params)
          .then((object) => {
            results = object.results;

            let reccount = results[1].value;
            if (results[0].value.exceededTransferLimit) {
              alert(
                "More than 4000 records meet the search criteria, only 4000 have been returned.  Please adjust search criteria."
              );
              document.getElementById("recCount").innerHTML =
                "More than 4000 records found.";
              hideLoading();
            } else {
              let featureSet = results[0].value.features;
              if (reccount > 4000) {
                alert(
                  "More than 4000 records meet the search criteria, only 4000 have been returned.  Please adjust search criteria."
                );
                document.getElementById("recCount").innerHTML =
                  "More than 4000 records found.";
              } else {
                document.getElementById("recCount").innerHTML =
                  featureSet.length.toString() + " Record(s) found.";
              }
              view.graphics.removeAll();
              let resultsGeometries = featureSet.map((f) => f.geometry);

              if (resultsGeometries.length > 0) {
                let mergedGeometry =
                  unionOperator.executeMany(resultsGeometries);
                let graphic = new Graphic({
                  symbol: {
                    type: "simple-fill",
                    color: [255, 0, 0, 0.5],
                    outline: null,
                  },
                  geometry: mergedGeometry,
                });
                view.graphics.add(graphic);
              }

              showResults(featureSet, config, parcelsLayer, view);
              exportExcel(featureSet);
            }

            hideLoading();
          });
      } else {
        let query = parcelsLayer.createQuery();
        query.returnGeometry = true;
        query.outFields = ["*"];
        if (sWhere != "") {
          query.where = sWhere;
          parcelsLayer.queryFeatures(query).then(function (results) {
            if (results.exceededTransferLimit) {
              alert(
                "More than 4000 records meet the search criteria, only 4000 have been returned.  Please adjust search criteria."
              );
              document.getElementById("recCount").innerHTML =
                "More than " +
                results.features.length.toString() +
                " Record(s) found.";
            } else {
              document.getElementById("recCount").innerHTML =
                results.features.length.toString() + " Record(s) found.";
            }

            view.graphics.removeAll();

            let featureSet = results.features;
            let resultsGeometries = featureSet.map((f) => f.geometry);
            if (resultsGeometries.length > 0) {
              let mergedGeometry = unionOperator.executeMany(resultsGeometries);

              let graphic = new Graphic({
                symbol: {
                  type: "simple-fill",
                  color: [255, 0, 0, 0.5],
                  outline: null,
                },
                geometry: mergedGeometry,
              });
              view.graphics.add(graphic);
            }

            showResults(featureSet, config, parcelsLayer, view);
            exportExcel(featureSet);
            hideLoading();
          });
        } else {
          alert("You must enter search criteria!");
          hideLoading();
        }
      }
    } else if (targetID == "resetCustom") {
      document.getElementById("txtParcel2").value = "";
      document.getElementById("txtOwner2").value = "";
      document.getElementById("txtStreet2").value = "";
      document.getElementById("txtDesc2").value = "";
      document.getElementById("txtAcreMin").value = "";
      document.getElementById("txtAcreMax").value = "";
      document.getElementById("txtSaleDateMin").value = "";
      document.getElementById("txtSaleDateMax").value = "";
      document.getElementById("txtSalePriceMin").value = "";
      document.getElementById("txtSalePriceMax").value = "";
      document.getElementById("selectZip").value = "";
      document.getElementById("selectUse").value = "";
      document.getElementById("selectCity").value = "";
      document.getElementById("selectOverlays").value = "";
      document.getElementById("selectZoning").value = "";
      document.getElementById("selectCouncil").value = "";
      document.getElementById("selectTax").value = "";
    } else if (targetID == "searchShapeButton") {
      showLoading();

      let sketchLayer;
      view.map.layers.forEach((layer) => {
        if (layer.title == "Sketch Layer") {
          sketchLayer = layer;
        }
      });

      if (sketchLayer && sketchLayer.graphics.items.length > 0) {
        let geometry = sketchLayer.graphics.items.map((g) => g.geometry);
        let mergedGeometry = unionOperator.executeMany(geometry);

        let query = parcelsLayer.createQuery();

        query.returnGeometry = true;
        query.outFields = ["*"];
        query.geometry = mergedGeometry;
        parcelsLayer.queryFeatures(query).then((results) => {
          if (results.exceededTransferLimit) {
            alert(
              "More than 4000 records meet the search criteria for a given shape, only 4000 have been returned for that shape. Try selecting a smaller area."
            );
          }

          let featureSet = results.features;
          view.graphics.removeAll();
          document.getElementById("recCount").innerHTML =
            featureSet.length.toString() + " Record(s) found.";
          let resultsGeometries = featureSet.map((f) => f.geometry);

          if (resultsGeometries.length > 0) {
            let mergedGeometry = unionOperator.executeMany(resultsGeometries);

            let graphic = new Graphic({
              symbol: {
                type: "simple-fill",
                color: [255, 0, 0, 0.5],
                outline: null,
              },
              geometry: mergedGeometry,
            });
            view.graphics.add(graphic);
          }

          showResults(featureSet, config, parcelsLayer, view);
          exportExcel(featureSet, parcelsLayer);
          hideLoading();
        });
      } else {
        hideLoading();
      }
    }
  }

  function showResults(featureSet, config, parcelsLayer, view) {
    zoomSelected(view);

    let items = [];
    let geometries = [];
    let PINs = [];

    featureSet.forEach((feature) => {
      let attributes = feature.attributes;
      let item = [
        attributes.APN,
        attributes.Owner,
        attributes.PropAddr,
        attributes.LegalDesc,
      ];
      items.push(item);
      geometries.push(feature.geometry);
      PINs.push(attributes.ParID);
    });

    if (document.getElementById("grid")) {
      document.getElementById("grid").remove();
    }

    createResultsTable(items, geometries, PINs, config, parcelsLayer, view);

    document.getElementById("resultsParentDiv").style.display = "flex";
    document.getElementById("searchTabs").style.display = "none";

    hideLoading();
  }

  function createResultsTable(items, geometries, PINs, config, parcelsLayer, view, sortColumn = -1, sortDirection = "ASC") {
    let grid = document.createElement("calcite-table");
    grid.id = "grid";
    grid.pageSize = 20;
    grid.caption = "Search Results";

    if (window.innerWidth <= 900) {
      grid.scale = "s";
    } else {
      grid.scale = "m";
    }
    grid.selectionMode = "single";
    grid.selectionDisplay = "none";

    // Store sort state on the grid element
    grid.dataset.lastSortColumn = sortColumn.toString();
    grid.dataset.lastSortDirection = sortDirection;

    document.getElementById("gridDiv").appendChild(grid);

    let header = document.createElement("calcite-table-row");
    header.slot = "table-header";

    let headers = ["Parcel ID", "Owner", "Address", "Description"];
    headers.forEach((headerText, columnIndex) => {
      let headerCell = document.createElement("calcite-table-header");
      headerCell.style.cursor = "pointer";
      headerCell.heading = headerText;
      if(sortColumn === columnIndex) {
        headerCell.description = sortDirection === "ASC" ? "▲" : "▼";
      }

      headerCell.onclick = () => { sortResultsTable(columnIndex, items, geometries, PINs, config, parcelsLayer, view) };
      header.appendChild(headerCell);
    });
    grid.appendChild(header);

    let currentSelectionGraphic = null;

    items.forEach((item, index) => {
      let row = document.createElement("calcite-table-row");

      item.forEach((property) => {
        let cell = document.createElement("calcite-table-cell");
        cell.textContent = property;
        row.appendChild(cell);
      });

      row.addEventListener("calciteTableRowSelect", (evt) => {
        if (row.selected) {
          if (currentSelectionGraphic) {
            view.graphics.remove(currentSelectionGraphic);
            currentSelectionGraphic = null;
          }

          view.goTo(geometries[index].extent);

          loadParcelDetails(
            item[0],
            PINs[index],
            config.WebServices,
            config.ParcelFields,
            parcelsLayer
          );

          currentSelectionGraphic = new Graphic({
            symbol: {
              type: "simple-fill",
              color: [255, 255, 0, 0.5],
              outline: {
                color: [255, 255, 0],
                width: 2,
              },
            },
            geometry: geometries[index],
          });
          view.graphics.add(currentSelectionGraphic);

          if (window.innerWidth < 600) {
            document.getElementById("searchDialog").open = false;
            document.getElementById("androidSearchDialog").style.display = "none";
            document.getElementById("btnSearchHeader").active = false;
            document.getElementById("btnSearchMobile").active = false;
          }
        } else {
          if (currentSelectionGraphic) {
            view.graphics.remove(currentSelectionGraphic);
            currentSelectionGraphic = null;
          }
          clearTables();
        }
      });

      if (items.length == 1) {
        row.selected = true;

        //trigger the selection event so that the side tables populate if only one item is in results
        const event = new CustomEvent("calciteTableRowSelect", {
          bubbles: true,
          detail: {
            selected: true,
          },
        });
        row.dispatchEvent(event);
      }

      grid.appendChild(row);
    });
  }

  sortResultsTable = async (columnIndex, items, geometries, PINs, config, parcelsLayer, view) => {
    showLoading();
  
    let grid = document.getElementById("grid");
    let lastSortColumn = grid ? parseInt(grid.dataset.lastSortColumn) : -1;
    let lastSortDirection = grid ? grid.dataset.lastSortDirection : "ASC";
  
    if (lastSortColumn === columnIndex) {
      lastSortDirection = lastSortDirection === "ASC" ? "DESC" : "ASC";
    } else {
      lastSortDirection = "ASC";
    }

    // Yield to browser to update UI
    await new Promise(resolve => setTimeout(resolve, 0));

    items.sort((a, b) => {
      const aVal = a[columnIndex] || "";
      const bVal = b[columnIndex] || "";
      return lastSortDirection === "ASC"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });

    if (grid) {
      grid.remove();
    }
  
    createResultsTable(items, geometries, PINs, config, parcelsLayer, view, columnIndex, lastSortDirection);
  
    hideLoading();
  }

  function loadConfig() {
    return getConfig();
  }

  function loadParcelDetails(
    parID,
    pin,
    webServices,
    parcelFields,
    parcelsLayer
  ) {
    clearTables();

    let query = parcelsLayer.createQuery();
    query.returnGeometry = true;
    query.outFields = ["*"];
    query.where = "APN='" + parID + "'";

    let tbl = document.createElement("calcite-table");
    tbl.id = "tblGeneralInfo";
    document.getElementById("divGeneralInfo").appendChild(tbl);

    const exportButton = document.getElementById("exportGeneralInfo");
    exportButton.style.display = "flex";
    exportButton.onclick = () => {
      exportTable(tbl.id, "GeneralInfo");
    }

    let printTableButton = document.getElementById("printGeneralInfo");
    printTableButton.style.display = "flex";
    printTableButton.onclick = () => {
      printTable(tbl.id, "General Info");
    };

    parcelsLayer.queryFeatures(query).then(function (results) {
      if (results.features.length > 0) {
        let attributes = results.features[0].attributes;

        parcelFields.forEach((fld, i) => {
          let row = document.createElement("calcite-table-row");
          if (i % 2 == 0) {
            row.className = "tableGrayRow";
          }
          let cell1 = document.createElement("calcite-table-cell");
          cell1.textContent = fld.DisplayText;
          row.appendChild(cell1);

          let cell2 = document.createElement("calcite-table-cell");
          let val = attributes[fld.FieldName] || "";

          if (fld.FieldName == "Council") {
            let link = document.createElement("a");
            if (val.includes(";")) {
              link.href =
                "https://www.nashville.gov/departments/council/districts";
            } else {
              link.href =
                "https://www.nashville.gov/departments/council/districts/district-" +
                Number(val.substring(0, 2))
            }
            link.target = "blank";
            link.textContent = val;
            cell2.appendChild(link);
          } else if (fld.FieldName == "APN") {
            let p = document.createElement("p");
            p.textContent = val;
            cell2.appendChild(p);

            let assessPro = document.createElement("a");
            assessPro.href = "#";
            assessPro.textContent = "View in AssessPro";
            assessPro.setAttribute("role", "button");
            assessPro.setAttribute("title", `View parcel ${val} in AssessPro`);
            assessPro.addEventListener("click", (e) => {
              if (val != "") {
                openAssessPro(val);
              }
              else {
                console.warn("Unable to generate AssessPro link, no parcel ID found.");
              }
            });
            cell2.appendChild(assessPro);

            viewTax = document.createElement("a");
            viewTax.href = "#";
            viewTax.textContent = "View Tax Info";
            viewTax.setAttribute("role", "button");
            viewTax.setAttribute("title", `View tax info for parcel ${val}`);
            viewTax.onclick = (e) => {
              window.open(
                `https://nashville-tn.mygovonline.com/mod.php?mod=propertytax&mode=public_view`
              );
            };
            cell2.appendChild(viewTax);

            printDetails = document.createElement("a");
            printDetails.href = "#";
            printDetails.textContent = "Print Parcel Details";
            printDetails.setAttribute("role", "button");
            printDetails.setAttribute(
              "title",
              `Print parcel details for parcel ${val}`
            );
            printDetails.onclick = (e) => {
              if (pin != "") {
                window.open(
                  "./PrintRecord.html?pin=" +
                  pin
                );
              }
              else {
                console.warn("Unable to print parcel details, no PIN found.");
              }
            };
            cell2.appendChild(printDetails);

          } else if (fld.FieldName == "PropAddr") {
            cell2.innerHTML =
              val +
              " " +
              attributes["PropCity"] +
              ", TN  " +
              attributes["PropZip"];
          } else if (fld.FieldName == "OwnAddr1") {
            cell2.innerHTML =
              val +
              " " +
              attributes["OwnCity"] +
              ", " +
              attributes["OwnState"] +
              " " +
              attributes["OwnZip"];
          } else if (fld.DataType == "long") {
            cell2.textContent = val.toLocaleString();
          } else if (fld.DataType == "double") {
            let f = val == "" ? 0 : parseFloat(val);
            cell2.textContent = f.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
            });
          } else if (fld.DataType == "date") {
            let dataAttr = new Date(val);
            isoDate =
              dataAttr.getUTCMonth() +
              1 +
              "/" +
              dataAttr.getUTCDate() +
              "/" +
              dataAttr.getUTCFullYear();
            cell2.innerHTML = isoDate;
          } else {
            if (fld.isLink) {
              if (fld.FieldName == "OwnInstr" || fld.FieldName == "PropInstr") {
                let str = val
                  .substring(val.indexOf("-") + 1, val.length)
                  .replace(" ", "");
                if (str.substring(0, 1) == 2) {
                  cell2.innerHTML =
                    "<a href='" +
                    fld.href +
                    "file=" +
                    str +
                    "' target='foo'>" +
                    val +
                    "</a>";
                } else {
                  let str2 = val.substring(val.indexOf("-") + 1, val.length);
                  let book = str2.substring(0, 8);
                  let page = str2.substring(9, str2.length);
                  cell2.innerHTML =
                    "<a href='" +
                    fld.href +
                    "book=" +
                    book +
                    "&page=" +
                    page +
                    "' target='foo'>" +
                    val +
                    "</a>";
                }
              } else {
                cell2.innerHTML =
                  "<a href='" +
                  fld.href +
                  val +
                  "' target='foo'>" +
                  val +
                  "</a>";
              }
            } else {
              cell2.textContent = val;
            }
          }

          row.appendChild(cell2);
          tbl.appendChild(row);
        });
      }
    });

    webServices.forEach((service) => {
      let url;
      if (service.Key == "PermitHistory") {
        url = service.ServiceURL + parID;
      } else {
        if (pin != "") {
          url = service.ServiceURL + pin;
        }
        else {
          console.error("Unable to load " + service.Key + " data, no PIN found.");
        }
      }

      getXML(url).then((xml) => {
        createTable(service, xml, parID);
      });
    });

    accordionElements = document.getElementsByClassName("element");
    Array.from(accordionElements).forEach((a) => {
      if (a.id == "accordionGeneralInfo") {
        a.expanded = true;
      } else {
        a.expanded = false;
      }
    });

    if ((document.getElementById("leftPane").style.display = "none")) {
      toggleLeftPanel();
    }

    let accordion = document.getElementById("accordionGeneralInfo");
    accordion.setFocus();
    document.querySelectorAll(".selectParcelPrompt").forEach((prompt) => { prompt.style.display = "none" });
  }

  function printTable(tableId, filename) {
    let table = document.getElementById(tableId);

    // Convert calcite-table to HTML table for printing
    let htmlTable = "<table border='1' style='width:100%;border-collapse:collapse'>";
    let rows = table.querySelectorAll("calcite-table-row");
    rows.forEach(row => {
      htmlTable += "<tr>";
      let cells = row.querySelectorAll("calcite-table-cell, calcite-table-header");
      cells.forEach((cell, i) => {
        if (i === 0) {
          htmlTable += `<td style="border:1px solid lightgray;width:33%;font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;">${cell.textContent}</td>`;
        }
        else {
          htmlTable += `<td style="border:1px solid lightgray;width:67%";font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;>${cell.textContent.replace("View in AssessProView Tax InfoPrint Parcel Details", "")}</td>`;
        }
      });
      htmlTable += "</tr>";
    });
    htmlTable += "</table>";

    const printWindow = window.open("", "_blank");
    const doc = printWindow.document;
    doc.open();
    doc.write(`
    <html>
      <head>
        <title>${filename}</title>
        <link rel="stylesheet" href="styles/printedtable.css" type="text/css"/>
      </head>
      <body>
        ${htmlTable}
        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
    </html>
  `);
    doc.close();
  }

  function exportTable(tableId, fileTitle) {
    let table = document.getElementById(tableId);
    let rows = table.childNodes;

    let csv = [];
    rows.forEach((row) => {
      cells = row.childNodes;
      const rowText = Array.from(cells).map((cell) => {
        let text = cell.innerText;
        if (text.includes(",") || text.includes('"') || text.includes("\n")) {
          text = `"${text.replace(/"/g, '""')}"`;
        }

        return text;
      });
      csv.push(rowText.join(","));
    });

    const csvFile = new Blob([csv.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });

    let downloadLink = document.createElement("a");
    downloadLink.download = `${fileTitle}.csv`;
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = "none";

    document.body.appendChild(downloadLink);
    downloadLink.click();
  }

  function exportExcel(featureSet) {
    if (featureSet == undefined) {
      return;
    }

    let csvText =
      '"Parcel ID","Parcel Address","Parcel City","Parcel State","Parcel Zipcode","Owner","Acquired Date","Sale Instrument","Sale Price","Owner Address","Owner City","Owner State","Owner Zipcode","Legal Description","Acreage","Frontage","Side","Parcel Instrument","Parcel Date","Census Tract","Tax District","Council District","Land Use","Assessment Date","Total Appraised Value","Improved Appraised Value","Land Appraised Value"\n';

    featureSet.forEach((feature) => {
      let attributes = feature.attributes;

      let ownDate = new Date(attributes["OwnDate"]);
      let ownDateStr =
        ownDate.getUTCMonth() +
        1 +
        "/" +
        ownDate.getUTCDate() +
        "/" +
        ownDate.getUTCFullYear();
      let propDate = new Date(attributes["PropDate"]);
      let propDateStr =
        propDate.getUTCMonth() +
        1 +
        "/" +
        propDate.getUTCDate() +
        "/" +
        propDate.getUTCFullYear();
      let assessDate = new Date(attributes["AssessDate"]);
      let assessDateStr =
        assessDate.getUTCMonth() +
        1 +
        "/" +
        assessDate.getUTCDate() +
        "/" +
        assessDate.getUTCFullYear();

      csvText +=
        '="' +
        attributes["APN"] +
        '","' +
        attributes["PropAddr"] +
        '","' +
        attributes["PropCity"] +
        '","' +
        'TN",="' +
        attributes["PropZip"] +
        '","' +
        attributes["Owner"] +
        '","' +
        ownDateStr.replace(/[^ -~]/g, "") +
        '","' +
        attributes["OwnInstr"] +
        '","' +
        attributes["SalePrice"] +
        '","' +
        attributes["OwnAddr1"] +
        '","' +
        attributes["OwnCity"] +
        '","' +
        attributes["OwnState"] +
        '",="' +
        attributes["OwnZip"] +
        '","' +
        attributes["LegalDesc"] +
        '","' +
        attributes["Acres"] +
        '","' +
        attributes["Front"] +
        '","' +
        attributes["Side"] +
        '","' +
        attributes["PropInstr"] +
        '","' +
        propDateStr.replace(/[^ -~]/g, "") +
        '","' +
        "470" +
        attributes["Tract"] +
        '","' +
        attributes["TaxDist"] +
        '","' +
        attributes["Council"] +
        '","' +
        attributes["LUDesc"] +
        '","' +
        assessDateStr.replace(/[^ -~]/g, "") +
        '","' +
        attributes["TotlAppr"] +
        '","' +
        attributes["ImprAppr"] +
        '","' +
        attributes["LandAppr"] +
        '"\n';
    });

    document.getElementById("exportExcel").onclick = () => {
      let csvFile = new Blob([csvText], { type: "text/csv" });
      let downloadLink = document.createElement("a");
      downloadLink.download = "search_results.csv";
      downloadLink.href = window.URL.createObjectURL(csvFile);
      downloadLink.style.display = "none";

      document.body.appendChild(downloadLink);
      downloadLink.click();
    };
  }

  function zoomSelected(view) {
    if (view.graphics.length === 0) return;

    let extent = null;

    view.graphics.forEach((graphic) => {
      if (extent === null) {
        extent = graphic.geometry.extent.clone();
      } else {
        extent = extent.union(graphic.geometry.extent);
      }
    });

    if (extent) {
      view.goTo(extent);
    }
  }

  function createTable(service, xml, parID) {
    let tbl = document.createElement("calcite-table");
    tbl.id = "tbl" + service.Key;
    document.getElementById("div" + service.Key).appendChild(tbl);

    let exportButton = document.getElementById("export" + service.Key);
    exportButton.style.display = "flex";
    exportButton.onclick = () => {
      exportTable(tbl.id, service.Key);
    };

    let printTableButton = document.getElementById("print" + service.Key);
    printTableButton.style.display = "flex";
    printTableButton.onclick = () => {
      printTable(tbl.id, service.Key);
    };

    if (service.Key == "PermitHistory") {
      let viewAllPermits = document.getElementById("viewAllPermitsLink");
      viewAllPermits.style.display = "flex";
      viewAllPermits.onclick = (e) => {
        if (parID != "") {
          window.open(
            `https://epermits.nashville.gov/#/search?searchCode=APN&page=1&searchText=${parID}&searchType=permit&orderBy=fullAddress%20ASC,permitNumber%20ASC`
          );
        } else {
          console.warn("Unable to open epermits.nashville.gov, no parcel ID provided");
        }
      };
    }

    let records = xml.getElementsByTagName("anyType");
    Array.from(records).forEach((record, i) => {
      service.Fields.forEach((fld) => {
        let row = document.createElement("calcite-table-row");
        if (i % 2 == 1) {
          row.className = "tableGrayRow";
        }
        tbl.appendChild(row);

        let cell1 = document.createElement("calcite-table-cell");
        row.appendChild(cell1);

        let cell2 = document.createElement("calcite-table-cell");
        row.appendChild(cell2);

        cell1.textContent = fld.DisplayText;

        const fieldElement = record.getElementsByTagName(fld.FieldName)[0];
        const value = fieldElement ? fieldElement.textContent : "";

        if (fld.DataType == "double") {
          let f = value == "" ? 0 : parseFloat(value);
          cell2.textContent = f.toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
          });
        } else if (fld.isLink) {
        if (fld.FieldName == "PermitNumber") {
          cell2.innerHTML =
            "<a href='https://epermits.nashville.gov/?#/search?searchCode=PRMT&page=1&searchText=" + value + "&searchType=permit' target='foo'>" +
            value +
            "</a>";
        
          } else if (fld.FieldName == "Ordinance") {
            cell2.innerHTML =
              "<a href='https://documents.nashville.gov/Request/Form/Legislation?legislationnumber=" +
              value +
              "' target='_new'>" +
              value +
              "</a>";
          } else if (fld.FieldName == "Instrument") {
            cell2.innerHTML =
              "<a href='https://documents.nashville.gov/Request/Form/Legislation?legislationnumber=" +
              value +
              "' target='_new'>" +
              value +
              "</a>";
          } else if (value.indexOf("~") == -1) {
            cell2.innerHTML = value;
          } else if (fld.FieldName == "filename") {
            cell2.innerHTML =
              "<a href='fec_disclaimer.html?fec=" +
              value.substring(value.indexOf("~") + 1, value.length) +
              "' target='foo'>" +
              value.substring(0, value.indexOf("~")) +
              "</a>";
          } else {
            cell2.innerHTML =
              "<a href='" +
              value.substring(value.indexOf("~") + 1, value.length) +
              "' target='foo'>" +
              value.substring(0, value.indexOf("~")) +
              "</a>";
          }
        } else {
          cell2.innerHTML = value;
        }
      });
    });
  }

  function clearTables() {
    if (document.getElementById("tblGeneralInfo")) {
      document.getElementById("tblGeneralInfo").remove();
    }
    if (document.getElementById("tblOwnerHistory")) {
      document.getElementById("tblOwnerHistory").remove();
    }
    if (document.getElementById("tblPropertyHistory")) {
      document.getElementById("tblPropertyHistory").remove();
    }
    if (document.getElementById("tblAssessmentHistory")) {
      document.getElementById("tblAssessmentHistory").remove();
    }
    if (document.getElementById("tblZoningHistory")) {
      document.getElementById("tblZoningHistory").remove();
    }
    if (document.getElementById("tblPermitHistory")) {
      document.getElementById("tblPermitHistory").remove();
    }
    if (document.getElementById("tblStormwater")) {
      document.getElementById("tblStormwater").remove();
    }
  }

  function getXML(url) {
    return fetch(url)
      .then((response) => response.text())
      .then((text) => {
        const parser = new DOMParser();
        return parser.parseFromString(text, "text/xml");
      })
      .catch((error) => {
        console.error("Error fetching from web service: ", error);
      });
  }

  function openAssessPro(val) {
    getXML(urls.assessProURL + val).then((xml) => {
      let accountNumbers = xml.getElementsByTagName("accountnumber");
      if (accountNumbers.length > 0) {
        Array.from(accountNumbers).forEach((accountNumber) => {
          window.open(
            "https://portal.padctn.org/OFS/WP/Print/" +
            accountNumber.textContent
          );
        });
      }
    });
  }
});

async function toggleButtonVis(a) {
  const closeAllPanels = () => {
    document.getElementById("searchDialog").open = false;
    document.getElementById("androidSearchDialog").style.display = "none";
    document.getElementById("basemapDialog").open = false;
    document.getElementById("layerlistDialog").open = false;
    document.getElementById("streetviewDialog").open = false;
    document.getElementById("printDialog").open = false;
    document.getElementById("coordinatesDialog").open = false;
    document.getElementById("contactUsDialog").open = false;
    document.getElementById("btnSearchHeader").active = false;
    document.getElementById("btnSearchMobile").active = false;
    document.getElementById("btnLayersHeader").active = false;
    document.getElementById("btnBasemapHeader").active = false;
    document.getElementById("btnCameraHeader").active = false;
    document.getElementById("btnPrintMapHeader").active = false;
    document.getElementById("btnMeasure").active = false;
    document.getElementById("btnArea").active = false;
    document.getElementById("btnContactUsHeader").active = false;
    document.getElementById("btnContactUs").active = false;
    document.getElementById("distanceMeasurement").style.display = "none";
    document.getElementById("distanceMeasurement").clear();
    document.getElementById("areaMeasurement").style.display = "none";
    document.getElementById("areaMeasurement").clear();
  };

  switch (a.id) {
    case "btnSearchHeader":
    case "btnSearchMobile":
      if (a.active) {
        closeAllPanels();
      } else {
        closeAllPanels();
        if (await isAndroid()) {
          document.getElementById("androidSearchDialog").style.display = a.active ? "none" : "block";
        }
        else {
          document.getElementById("searchDialog").open = !a.active;
        }
        document.getElementById("btnSearchHeader").active = !a.active;
        document.getElementById("btnSearchMobile").active = !a.active;
      }
      break;

    case "btnBasemapHeader":
    case "btnBasemapMobile":
      if (a.active) {
        closeAllPanels();
      } else {
        closeAllPanels();
        document.getElementById("basemapDialog").open = !a.active;
        document.getElementById("btnBasemapHeader").active = !a.active;
        document.getElementById("btnBasemapMobile").active = !a.active;
      }
      break;

    case "btnLayersHeader":
    case "btnLayersMobile":
      if (a.active) {
        closeAllPanels();
      } else {
        closeAllPanels();
        document.getElementById("layerlistDialog").open = !a.active;
        document.getElementById("btnLayersHeader").active = !a.active;
        document.getElementById("btnLayersMobile").active = !a.active;
      }
      break;

    case "btnCameraHeader":
    case "btnCameraMobile":
      if (a.active) {
        closeAllPanels();
      }
      else {
        closeAllPanels();
        document.getElementById("streetviewDialog").open = !a.active;
        document.getElementById("btnCameraHeader").active = !a.active;
        document.getElementById("btnCameraMobile").active = !a.active;
      }
      break;

    case "btnPrintMapHeader":
    case "btnPrintMapMobile":
      if (a.active) {
        closeAllPanels();
      } else {
        closeAllPanels();
        document.getElementById("printDialog").open = !a.active;
        document.getElementById("btnPrintMapHeader").active = !a.active;
        document.getElementById("btnPrintMapMobile").active = !a.active;
      }
      break;

    case "btnCoordinatesHeader":
    case "btnCoordinatesMobile":
      if (a.active) {
        closeAllPanels();
      } else {
        closeAllPanels();
        document.getElementById("coordinatesDialog").open = !a.active;
        document.getElementById("btnCoordinatesHeader").active = !a.active;
        document.getElementById("btnCoordinatesMobile").active = !a.active;
      }
      break;

    case "btnToggleLegendHeader":
    case "btnToggleLegendMobile":
      const legend = document.querySelectorAll("arcgis-legend")[0];
      legend.style.display = !a.active ? "block" : "none";
      document.getElementById("btnToggleLegendHeader").active = !a.active;
      document.getElementById("btnToggleLegendMobile").active = !a.active;
      break;

    case "btnMeasure":
      if (a.active) {
        closeAllPanels();
      } else {
        closeAllPanels();
        document.getElementById("distanceMeasurement").style.display = "block";
        a.active = !a.active;
      }
      break;

    case "btnArea":
      if (a.active) {
        closeAllPanels();
      } else {
        closeAllPanels();
        document.getElementById("areaMeasurement").style.display = "block";
        a.active = !a.active;
      }
      break;

    case "btnHelpDocument":
    case "btnHelpDocumentHeader":
      window.open(
        "./nashville_parcel_viewer_help.pdf"
      );
      break;

    case "btnContactUsHeader":
    case "btnContactUs":
      if (a.active) {
        closeAllPanels();
      } else {
        closeAllPanels();
        document.getElementById("contactUsDialog").open = !a.active;
        document.getElementById("btnContactUsHeader").active = !a.active;
        document.getElementById("btnContactUs").active = !a.active;
      }
      break;
  }
}

function backButton() {
  document.getElementById("searchTabs").style.display = "flex";
  document.getElementById("resultsParentDiv").style.display = "none";
}

function closeLayerList() {
  document.getElementById("divLayerList").style.display = "none";
}

function closeBasemap() {
  document.getElementById("divBasemap").style.display = "none";
}

function showLoading() {
  document.getElementById("loader").style.display = "block";
}

function hideLoading() {
  document.getElementById("loader").style.display = "none";
}

function isDate(dateStr) {
  let datePat = /^(\d{1,2})(\/|-)(\d{1,2})(\/|-)(\d{4})$/;
  let matchArray = dateStr.match(datePat);

  if (matchArray == null) {
    if (dateStr != "") {
      alert("Please enter date as either mm/dd/yyyy or mm-dd-yyyy.");
    }

    return false;
  }

  month = matchArray[1];
  day = matchArray[3];
  year = matchArray[5];

  if (month < 1 || month > 12) {
    alert("Month must be between 1 and 12.");
    return false;
  }

  if (day < 1 || day > 31) {
    alert("Day must be between 1 and 31.");
    return false;
  }

  if ((month == 4 || month == 6 || month == 9 || month == 11) && day == 31) {
    alert("Month " + month + " doesn`t have 31 days!");
    return false;
  }

  if (month == 2) {
    let isleap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    if (day > 29 || (day == 29 && !isleap)) {
      alert("February " + year + " doesn`t have " + day + " days!");
      return false;
    }
  }
  return true;
}

function showSplashScreen() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  document.body.appendChild(overlay);
  document.getElementById("divSplashScreen").style.display = "block";
}

function hideSplashScreen() {
  const overlay = document.querySelector(".modal-overlay");
  if (overlay) {
    overlay.remove();
  }
  document.getElementById("divSplashScreen").style.display = "none";
}

function toggleLeftPanel() {
  let leftPane = document.getElementById("leftPane");
  let collapseButton = document.getElementById("leftPaneCollapse");

  if (leftPane.style.display != "none") {
    leftPane.style.display = "none";
    if (window.innerWidth > 600) {
      collapseButton.iconStart = "chevrons-right";
    } else {
      collapseButton.iconStart = "chevrons-up";
    }
  } else {
    leftPane.style.display = "block";
    if (window.innerWidth > 600) {
      collapseButton.iconStart = "chevrons-left";
    } else {
      collapseButton.iconStart = "chevrons-down";
    }
  }
}

async function isAndroid() {
  if (navigator.userAgentData) {
    const ua = await navigator.userAgentData.getHighEntropyValues(["platform"]);
    return ua.platform.toLowerCase() === "android";
  } else {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    return /android/i.test(userAgent);
  }
}
