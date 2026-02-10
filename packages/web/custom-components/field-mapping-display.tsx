"use client";

import { DestinationType } from "shared/src/db/schema";

interface FieldMapping {
  calendarField: string;
  destinationField: string;
  destinationFieldType: string;
}

const NOTION_FIELD_MAPPINGS: FieldMapping[] = [
  {
    calendarField: "Event Title",
    destinationField: "Title",
    destinationFieldType: "title",
  },
  {
    calendarField: "Start Date/Time",
    destinationField: "Start",
    destinationFieldType: "date",
  },
  {
    calendarField: "End Date/Time",
    destinationField: "End",
    destinationFieldType: "date",
  },
  {
    calendarField: "Duration",
    destinationField: "Duration",
    destinationFieldType: "number (hours)",
  },
  {
    calendarField: "Calendar Name",
    destinationField: "Calendar",
    destinationFieldType: "select",
  },
  {
    calendarField: "Description",
    destinationField: "Description",
    destinationFieldType: "rich_text",
  },
  {
    calendarField: "Location",
    destinationField: "Location",
    destinationFieldType: "rich_text",
  },
  {
    calendarField: "Attendees",
    destinationField: "Attendees",
    destinationFieldType: "multi_select",
  },
  {
    calendarField: "Event Status",
    destinationField: "Status",
    destinationFieldType: "select",
  },
];

const GOOGLE_SHEETS_FIELD_MAPPINGS: FieldMapping[] = [
  {
    calendarField: "Event Title",
    destinationField: "Column A",
    destinationFieldType: "text",
  },
  {
    calendarField: "Start Date/Time",
    destinationField: "Column B",
    destinationFieldType: "date/time",
  },
  {
    calendarField: "End Date/Time",
    destinationField: "Column C",
    destinationFieldType: "date/time",
  },
  {
    calendarField: "Duration",
    destinationField: "Column D",
    destinationFieldType: "number (hours)",
  },
  {
    calendarField: "Calendar Name",
    destinationField: "Column E",
    destinationFieldType: "text",
  },
  {
    calendarField: "Description",
    destinationField: "Column F",
    destinationFieldType: "text",
  },
  {
    calendarField: "Location",
    destinationField: "Column G",
    destinationFieldType: "text",
  },
  {
    calendarField: "Attendees",
    destinationField: "Column H",
    destinationFieldType: "text (comma-separated)",
  },
  {
    calendarField: "Event Status",
    destinationField: "Column I",
    destinationFieldType: "text",
  },
];

const AIRTABLE_FIELD_MAPPINGS: FieldMapping[] = [
  {
    calendarField: "Event Title",
    destinationField: "Name",
    destinationFieldType: "Single line text",
  },
  {
    calendarField: "Start Date/Time",
    destinationField: "Start",
    destinationFieldType: "Date",
  },
  {
    calendarField: "End Date/Time",
    destinationField: "End",
    destinationFieldType: "Date",
  },
  {
    calendarField: "Duration",
    destinationField: "Duration",
    destinationFieldType: "Number",
  },
  {
    calendarField: "Calendar Name",
    destinationField: "Calendar",
    destinationFieldType: "Single select",
  },
  {
    calendarField: "Description",
    destinationField: "Description",
    destinationFieldType: "Long text",
  },
  {
    calendarField: "Location",
    destinationField: "Location",
    destinationFieldType: "Single line text",
  },
  {
    calendarField: "Attendees",
    destinationField: "Attendees",
    destinationFieldType: "Multiple select",
  },
  {
    calendarField: "Event Status",
    destinationField: "Status",
    destinationFieldType: "Single select",
  },
];

function getMappingsForType(destinationType: string): FieldMapping[] {
  switch (destinationType) {
    case DestinationType.NOTION:
      return NOTION_FIELD_MAPPINGS;
    case DestinationType.GOOGLE_SHEETS:
      return GOOGLE_SHEETS_FIELD_MAPPINGS;
    case DestinationType.AIRTABLE:
      return AIRTABLE_FIELD_MAPPINGS;
    default:
      return [];
  }
}

interface FieldMappingDisplayProps {
  destinationType: string;
}

export function FieldMappingDisplay({
  destinationType,
}: FieldMappingDisplayProps) {
  const mappings = getMappingsForType(destinationType);

  if (mappings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Field Mapping</h4>
      <div className="rounded-md border">
        <div className="grid grid-cols-3 gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
          <div>Calendar Event Field</div>
          <div>Destination Property</div>
          <div>Property Type</div>
        </div>
        {mappings.map((mapping) => (
          <div
            key={mapping.calendarField}
            className="grid grid-cols-3 gap-2 border-b px-3 py-2 text-sm last:border-b-0"
          >
            <div>{mapping.calendarField}</div>
            <div className="font-medium">{mapping.destinationField}</div>
            <div className="text-muted-foreground">
              {mapping.destinationFieldType}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {destinationType === DestinationType.NOTION
          ? "Properties will be automatically created in your Notion database if they don't exist."
          : destinationType === DestinationType.AIRTABLE
            ? "Fields will be matched by name in your Airtable table."
            : "Events are written as rows with a header row added automatically."}
      </p>
    </div>
  );
}
