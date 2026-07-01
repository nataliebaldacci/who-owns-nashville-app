function getConfig() {
  return {
    WebServices: [
      {
        Key: "OwnerHistory",
        Title: "Owner History",
        ServiceURL:
          "../ParcelService/Search.asmx/GetOwnerHistory?onlyactive=false&pin=",
        Grouping: "OwnerInfo",
        Index: 0,
        Fields: [
          {
            DisplayText: "Owner Name",
            FieldName: "OwnerName",
            DataType: "string",
          },
          {
            DisplayText: "Acquired Date",
            FieldName: "OwnerDate",
            DataType: "date",
          },
          {
            DisplayText: "Sale Instrument",
            FieldName: "OwnerDocumentHref",
            DataType: "string",
            isLink: true,
          },
          {
            DisplayText: "Mailing Address",
            FieldName: "OwnerAddress",
            DataType: "string",
            isDate: true,
          },
          {
            DisplayText: "Mailing Country",
            FieldName: "OwnerCountry",
            DataType: "string",
          },
          {
            DisplayText: "Sale Amount",
            FieldName: "SaleAmount",
            DataType: "double",
          },
          {
            DisplayText: "Status",
            FieldName: "Status",
            DataType: "string",
          },
        ],
      },
      {
        Key: "PropertyHistory",
        Title: "Property History",
        ServiceURL:
          "../ParcelService/Search.asmx/GetPropertyHistory?onlyactive=false&pin=",
        Grouping: "PropertyInfo",
        Index: 1,
        Fields: [
          {
            DisplayText: "Date Established",
            FieldName: "PropertyDate",
            DataType: "date",
            isDate: true,
          },
          {
            DisplayText: "Date Inactive",
            FieldName: "PropertyDateInactive",
            DataType: "date",
            isDate: true,
          },
          {
            DisplayText: "Instrument:",
            FieldName: "PropertyDocumentHref",
            DataType: "string",
            isLink: true,
          },
          {
            DisplayText: "Acreage",
            FieldName: "Acreage",
            DataType: "string",
          },
          {
            DisplayText: "Description",
            FieldName: "Description",
            DataType: "string",
          },
          {
            DisplayText: "Frontage Dimension",
            FieldName: "Frontage",
            DataType: "string",
          },
          {
            DisplayText: "Side Dimension",
            FieldName: "Side",
            DataType: "string",
          },
          {
            DisplayText: "Status",
            FieldName: "Status",
            DataType: "string",
          },
        ],
      },
      {
        Key: "ZoningHistory",
        Title: "Zoning",
        ServiceURL:
          "../ParcelService/Search.asmx/GetZoningHistory?onlyactive=false&pin=",
        Grouping: "ZoningInfo",
        Index: 2,
        Fields: [
          {
            DisplayText: "Zone Code",
            FieldName: "Zoning",
            DataType: "string",
          },
          {
            DisplayText: "Zone Description",
            FieldName: "Description",
            DataType: "string",
          },
          {
            DisplayText: "Effective Date",
            FieldName: "EffectiveDate",
            DataType: "date",
            isDate: true,
          },
          {
            DisplayText: "Ordinance",
            FieldName: "Ordinance",
            DataType: "string",
            isLink: true,
          },
          {
            DisplayText: "Case Number",
            FieldName: "CaseNumber",
            DataType: "string",
          },
          {
            DisplayText: "Status",
            FieldName: "Status",
            DataType: "string",
          },
        ],
      },
      {
        Key: "AssessmentHistory",
        Title: "Assessments",
        ServiceURL:
          "../ParcelService/Search.asmx/GetAssessmentHistory?onlyactive=false&pin=",
        Grouping: "AssessmentInfo",
        Index: 3,
        Fields: [
          {
            DisplayText: "Class",
            FieldName: "ClassDesc",
            DataType: "string",
          },
          {
            DisplayText: "Effective Date",
            FieldName: "EffectiveDate",
            DataType: "date",
            isDate: true,
          },
          {
            DisplayText: "Land Appraised Value",
            FieldName: "LandApprValue",
            DataType: "double",
          },
          {
            DisplayText: "Improvement Appraised Value",
            FieldName: "ImproveApprValue",
            DataType: "double",
          },
          {
            DisplayText: "Total Appraised Value",
            FieldName: "TotalApprValue",
            DataType: "double",
          },
          {
            DisplayText: "Status",
            FieldName: "Status",
            DataType: "string",
          },
        ],
      },
      {
        Key: "PermitHistory",
        Title: "Codes Permit History",
        ServiceURL:
          "../ParcelService/Search.asmx/GetPermitHistory?apn=",
        Grouping: "PermitInfo",
        Index: 4,
        Fields: [
          {
            DisplayText: "Permit Number",
            FieldName: "PermitNumber",
            DataType: "string",
            isLink: true,
          },
          {
            DisplayText: "Permit Type",
            FieldName: "PermitType",
            DataType: "string",
          },
          {
            DisplayText: "Permit SubType",
            FieldName: "PermitSubType",
            DataType: "string",
          },
          {
            DisplayText: "Date Issued",
            FieldName: "DateIssued",
            DataType: "string",
            isDate: true,
          },
          {
            DisplayText: "Purpose",
            FieldName: "Purpose",
            DataType: "string",
          },
          {
            DisplayText: "Contractor",
            FieldName: "Contractor",
            DataType: "string",
          },
          {
            DisplayText: "Value",
            FieldName: "Value",
            DataType: "double",
          },
          {
            DisplayText: "Status",
            FieldName: "Status",
            DataType: "string",
          },
        ],
      }
    ],
    Basemaps: [
      {
        Layer: "Nashville Basemap",
        LayerURL:
        "https://maps.nashville.gov/arcgis/rest/services/Basemaps/NashvilleBasemapMuted/MapServer",
        Thumbnail: "images/graybasemap.png",
        Visible: false,
      },
      {
        Layer: "2025 Aerial Imagery",
        LayerURL:
          "https://svc.pictometry.com/Image/8872F04A-7C44-EB93-C2FB-EAA73C21DDF8/wmts",
        Thumbnail: "images/imagery.png",
        Visible: false,
        WMTS: true,
        ActiveSubLayer: "PICT-TNDAVI25-pUUnhZB3O8",
      },
      {
        Layer: "2024 Aerial Imagery",
        LayerURL:
          "https://svc.pictometry.com/Image/8872F04A-7C44-EB93-C2FB-EAA73C21DDF8/wmts",
        Thumbnail: "images/imagery.png",
        Visible: false,
        WMTS: true,
        ActiveSubLayer: "PICT-TNDAVI24-xwN7kDO8hw"
      },
      {
        Layer: "2023 Aerial Imagery",
        LayerURL:
          "https://maps.nashville.gov/arcgis/rest/services/Imagery/2023Imagery_WGS84/MapServer",
        Thumbnail: "images/imagery.png",
        Visible: false,
      },
      {
        Layer: "2022 Aerial Imagery",
        LayerURL:
          "https://maps.nashville.gov/arcgis/rest/services/Imagery/2022Imagery_WGS84/MapServer",
        Thumbnail: "images/imagery.png",
        Visible: false,
      },
      {
        Layer: "2020 Aerial Imagery",
        LayerURL:
          "https://maps.nashville.gov/arcgis/rest/services/Imagery/2020Imagery_WGS84/MapServer",
        Thumbnail: "images/imagery.png",
        Visible: false,
      },
      {
        Layer: "2018 Aerial Imagery",
        LayerURL:
          "https://maps.nashville.gov/arcgis/rest/services/Imagery/2018Imagery_WGS84/MapServer",
        Thumbnail: "images/imagery.png",
        Visible: false,
      },
      {
        Layer: "2017 Aerial Imagery",
        LayerURL:
          "https://maps.nashville.gov/arcgis/rest/services/Imagery/2017Imagery_WGS84/MapServer",
        Thumbnail: "images/imagery.png",
        Visible: false,
      },
      {
        Layer: "2016 Aerial Imagery",
        LayerURL:
          "https://maps.nashville.gov/arcgis/rest/services/Imagery/2016Imagery_WGS84/MapServer",
        Thumbnail: "images/imagery.png",
        Visible: false,
      },
      {
        Layer: "2014 Aerial Imagery",
        LayerURL:
          "https://maps.nashville.gov/arcgis/rest/services/Imagery/2014Imagery_WGS84/MapServer",
        Thumbnail: "images/imagery.png",
        Visible: false,
      },
      {
        Layer: "2013 Aerial Imagery",
        LayerURL:
          "https://maps.nashville.gov/arcgis/rest/services/Imagery/2013PictometryImagery_WGS84/MapServer",
        Thumbnail: "images/imagery.png",
        Visible: false,
      },
      {
        Layer: "May 2010 Flood Imagery",
        LayerURL:
          "https://maps.nashville.gov/arcgis/rest/services/Imagery/May2010_FloodImagery_WGS84/MapServer",
        Thumbnail: "images/imagery.png",
        Visible: false,
      },
      {
        Layer: "2010 Aerial Imagery",
        LayerURL:
          "https://maps.nashville.gov/arcgis/rest/services/Imagery/2010Imagery_WGS84/MapServer",
        Thumbnail: "images/imagery.png",
        Visible: false,
      },
      {
        Layer: "2009 Aerial Imagery",
        LayerURL:
          "https://maps.nashville.gov/arcgis/rest/services/Imagery/2008Imagery_WGS84/MapServer",
        Thumbnail: "images/imagery.png",
        Visible: false,
      },
      {
        Layer: "2008 Aerial Imagery",
        LayerURL:
          "https://maps.nashville.gov/arcgis/rest/services/Imagery/2009Imagery_WGS84/MapServer",
        Thumbnail: "images/imagery.png",
        Visible: false,
      },
      {
        Layer: "2006 Aerial Imagery",
        LayerURL:
          "https://maps.nashville.gov/arcgis/rest/services/Imagery/2006Imagery_WGS84/MapServer",
        Thumbnail: "images/imagery.png",
        Visible: false,
      },
      {
        Layer: "2005 Aerial Imagery",
        LayerURL:
          "https://maps.nashville.gov/arcgis/rest/services/Imagery/2005Imagery_WGS84/MapServer",
        Thumbnail: "images/imagery.png",
        Visible: false,
      },
      {
        Layer: "2004 Aerial Imagery",
        LayerURL:
          "https://maps.nashville.gov/arcgis/rest/services/Imagery/2004Imagery_WGS84/MapServer",
        Thumbnail: "images/imagery.png",
        Visible: false,
      },
      {
        Layer: "2003 Aerial Imagery",
        LayerURL:
          "https://maps.nashville.gov/arcgis/rest/services/Imagery/2003Imagery_WGS84/MapServer",
        Thumbnail: "images/imagery.png",
        Visible: false,
      },
      {
        Layer: "2000 Aerial Imagery",
        LayerURL:
          "https://maps.nashville.gov/arcgis/rest/services/Imagery/2000Imagery_WGS84/MapServer",
        Thumbnail: "images/imagery.png",
        Visible: false,
      },
      {
        Layer: "1996 Aerial Imagery",
        LayerURL:
          "https://maps.nashville.gov/arcgis/rest/services/Imagery/1996Imagery_WGS84/MapServer",
        Thumbnail: "images/imagerybw.png",
        Visible: false,
      },
    ],
    ParcelFields: [
      {
        DisplayText: "Parcel ID:",
        FieldName: "APN",
        DataType: "string",
        PrintSection: "Parcel",
      },
      {
        DisplayText: "Parcel Address:",
        FieldName: "PropAddr",
        DataType: "string",
        PrintSection: "Parcel",
      },
      {
        DisplayText: "Owner:",
        FieldName: "Owner",
        DataType: "string",
        PrintSection: "Parcel",
      },
      {
        DisplayText: "Acquired Date:",
        FieldName: "OwnDate",
        DataType: "date",
        PrintSection: "Parcel",
      },
      {
        DisplayText: "Sale Price:",
        FieldName: "SalePrice",
        DataType: "double",
        PrintSection: "Parcel",
      },
      {
        DisplayText: "Sale Instrument:",
        FieldName: "OwnInstr",
        DataType: "string",
        isLink: true,
        href: "https://www.davidsonportal.com/gis/file.php?",
        PrintSection: "Parcel",
      },
      {
        DisplayText: "Mailing Address:",
        FieldName: "OwnAddr1",
        DataType: "string",
        PrintSection: "Parcel",
      },
      {
        DisplayText: "Legal Description:",
        FieldName: "LegalDesc",
        DataType: "string",
        PrintSection: "Parcel",
      },
      {
        DisplayText: "Acreage:",
        FieldName: "Acres",
        DataType: "string",
        PrintSection: "Parcel",
      },
      {
        DisplayText: "Frontage Dimension:",
        FieldName: "Front",
        DataType: "string",
        PrintSection: "Parcel",
      },
      {
        DisplayText: "Side Dimension:",
        FieldName: "Side",
        DataType: "string",
        PrintSection: "Parcel",
      },
      {
        DisplayText: "Parcel Instrument:",
        FieldName: "PropInstr",
        DataType: "string",
        isLink: true,
        href: "https://www.davidsonportal.com/gis/file.php?",
        PrintSection: "Parcel",
      },
      {
        DisplayText: "Parcel Instrument Date:",
        FieldName: "PropDate",
        DataType: "date",
        PrintSection: "Parcel",
      },
      {
        DisplayText: "Census Tract:",
        FieldName: "Tract",
        DataType: "string",
        PrintSection: "Parcel",
      },
      {
        DisplayText: "Tax District:",
        FieldName: "TaxDist",
        DataType: "string",
        PrintSection: "Parcel",
      },
      {
        DisplayText: "Council District:",
        FieldName: "Council",
        DataType: "string",
        PrintSection: "Parcel",
      },
      {
        DisplayText: "Land Use Description:",
        FieldName: "LUDesc",
        DataType: "string",
        PrintSection: "Parcel",
      },
      {
        DisplayText: "Assessment Date:",
        FieldName: "AssessDate",
        DataType: "date",
        PrintSection: "",
      },
      {
        DisplayText: "Total Appraised Value:",
        FieldName: "TotlAppr",
        DataType: "double",
        PrintSection: "",
      },
      {
        DisplayText: "Improved Appraised Value:",
        FieldName: "ImprAppr",
        DataType: "double",
        PrintSection: "",
      },
      {
        DisplayText: "Land Appraised Value:",
        FieldName: "LandAppr",
        DataType: "double",
        PrintSection: "",
      },
      {
        DisplayText: "Square Footage:",
        FieldName: "Shape.STArea()",
        DataType: "long",
        PrintSection: "",
      },
    ],
  };
}
