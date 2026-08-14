export type SampleProjectState =
  | "open"
  | "completed"
  | "reopened"
  | "cancelled"
  | "archived";

export type SampleVisit = {
  cycleNumber: 1 | 2;
  dayOffset: number;
  status: "scheduled" | "completed" | "cancelled";
  notes: string;
};

export type SampleRevision = {
  cycleNumber: 1 | 2;
  dayOffset: number;
  scopeText: string;
  priceChange: number;
  reason: string;
  visitRequirement: "not_required" | "required";
  linkedVisitIndex: number | null;
};

export type SampleProject = {
  slug: string;
  title: string;
  description: string;
  clientNotes: string;
  state: SampleProjectState;
  ageDays: number;
  durationDays: number;
  finalPrice: number;
  cancellationReason?: string;
  reopenReason?: string;
  beforeCaptions: string[];
  duringCaptions: string[];
  afterCaptions: string[];
  cycleOneNotes: string[];
  cycleTwoNotes?: string[];
  visits: SampleVisit[];
  revision?: SampleRevision;
  journeySummary: string;
};

export const sampleProjects: readonly SampleProject[] = [
  {
    slug: "roof-leak-investigation",
    title: "Roof leak investigation",
    description:
      "Trace recurring ceiling moisture to the roof penetration, remove wet insulation, seal the source, and restore the ceiling.",
    clientNotes:
      "Prefers text updates. Protect the front room furniture before opening the ceiling.",
    state: "reopened",
    ageDays: 18,
    durationDays: 5,
    finalPrice: 1_485,
    reopenReason:
      "A faint moisture ring returned after a wind-driven storm; verify the vent flashing before any cosmetic touch-up.",
    beforeCaptions: [
      "Water ring visible at the front-room ceiling after rain.",
      "Paint blistering and soft gypsum at the center of the stain.",
      "Wet attic insulation directly above the damaged ceiling.",
    ],
    duringCaptions: [
      "Saturated insulation removed so the roof deck can dry.",
      "Vent penetration inspected from the attic for the active entry point.",
    ],
    afterCaptions: [
      "Ceiling opening patched and first finish coat applied.",
      "Attic cavity left clean and dry after the leak repair.",
      "Ceiling restored and blended after final paint.",
    ],
    cycleOneNotes: [
      "Moisture meter confirmed the ceiling was still damp. Covered the room and opened only the affected area.",
      "Wet insulation was isolated around the plumbing vent. Roof-side seal at the boot was the likely entry point.",
      "Cavity dried overnight, then the ceiling was patched, finished, primed, and painted.",
    ],
    cycleTwoNotes: [
      "Client sent a photo after a hard storm. The old repair is intact, but a light ring is visible beside it; return visit scheduled before repainting anything.",
    ],
    visits: [
      {
        cycleNumber: 1,
        dayOffset: 1,
        status: "completed",
        notes: "Diagnosed the ceiling stain and opened the wet section for attic access.",
      },
      {
        cycleNumber: 2,
        dayOffset: -2,
        status: "scheduled",
        notes: "Water-test the vent flashing and inspect the reopened moisture report.",
      },
    ],
    revision: {
      cycleNumber: 1,
      dayOffset: 2,
      scopeText:
        "Remove saturated insulation and patch the opened ceiling after the roof penetration is sealed and the cavity tests dry.",
      priceChange: 620,
      reason: "Hidden wet insulation was discovered above the stained ceiling.",
      visitRequirement: "not_required",
      linkedVisitIndex: 0,
    },
    journeySummary:
      "The original leak cycle documented the ceiling damage, traced moisture to the vent penetration, removed wet insulation, and restored the ceiling. Cycle 1 closed with a complete before/during/after record and a VOW. The job is now in Cycle 2 after a faint ring returned following a wind-driven storm; a diagnostic water test is scheduled.",
  },
  {
    slug: "dead-kitchen-outlet",
    title: "Dead kitchen outlet",
    description:
      "Diagnose the failed countertop receptacle, replace the damaged device, and verify GFCI protection and polarity.",
    clientNotes:
      "Kitchen access is easiest before 3 PM. Client wants the counter wiped down when work is complete.",
    state: "completed",
    ageDays: 2,
    durationDays: 1,
    finalPrice: 285,
    beforeCaptions: [
      "Countertop receptacle identified as the dead device.",
      "Plug-in tester confirms no usable power at the receptacle.",
      "Existing device and cover documented before removal.",
    ],
    duringCaptions: [
      "Branch wiring tested with the receptacle pulled forward.",
      "Conductors transferred to the replacement receptacle and torqued.",
    ],
    afterCaptions: [
      "Replacement receptacle secured and final voltage checked.",
      "Tester confirms correct wiring and restored protection.",
      "Finished outlet sits square with the tile and cover installed.",
    ],
    cycleOneNotes: [
      "Upstream GFCI was live, but the countertop receptacle had failed internally.",
      "Replaced the receptacle, corrected a loose terminal, and verified line/load orientation.",
      "Tested polarity, ground, and GFCI trip/reset with the client present.",
    ],
    visits: [
      {
        cycleNumber: 1,
        dayOffset: 0,
        status: "completed",
        notes: "Single service visit: diagnosis, replacement, and operational test completed.",
      },
    ],
    journeySummary:
      "The dead countertop outlet was traced to a failed receptacle and a loose terminal. The device was replaced, seated square to the tile, and tested for voltage, polarity, ground, and GFCI operation. The cycle is complete with full photo documentation and a VOW.",
  },
  {
    slug: "drywall-repair",
    title: "Drywall repair",
    description:
      "Repair the puncture and adjacent seam crack, build the finish in thin coats, sand, and prepare the wall for paint.",
    clientNotes:
      "Keep the hallway passable and contain sanding dust. Paint color is stored in the basement.",
    state: "open",
    ageDays: 8,
    durationDays: 4,
    finalPrice: 640,
    beforeCaptions: [
      "Impact puncture and crushed gypsum documented before repair.",
      "Vertical seam crack and puncture documented above the baseboard.",
      "Wide view records the damaged wall and surrounding finish.",
    ],
    duringCaptions: [
      "Backing and patch installed at the puncture.",
      "Joint compound applied across the patch and nearby crack.",
    ],
    afterCaptions: [
      "Repaired seam sanded flat before primer.",
      "Skim coat feathered beyond the patch edges.",
      "Wall restored after primer and finish paint.",
    ],
    cycleOneNotes: [
      "Impact puncture crosses an older vertical seam crack. Loose paper was removed before installing backing.",
      "Patch is installed and the first two coats are curing. Dust control remains in place.",
      "Final sanding and paint blend are complete. Keep the cycle open for the client walkthrough and any daylight touch-up.",
    ],
    visits: [
      {
        cycleNumber: 1,
        dayOffset: 0,
        status: "completed",
        notes: "Installed backing and patch, then applied the bedding coat.",
      },
      {
        cycleNumber: 1,
        dayOffset: -1,
        status: "scheduled",
        notes: "Client walkthrough, daylight finish check, and formal close-out.",
      },
    ],
    journeySummary:
      "The damaged drywall and adjacent seam crack were opened, backed, patched, coated, sanded, and painted. The finished wall is documented, but the cycle remains open for the client walkthrough, daylight finish check, and formal close-out.",
  },
  {
    slug: "sump-pump-problem",
    title: "Sump pump problem",
    description:
      "Diagnose the flooded sump, replace the failed pump and check valve, and verify automatic operation under load.",
    clientNotes:
      "Call before entering the basement. Storage shelves must stay dry and accessible.",
    state: "open",
    ageDays: 5,
    durationDays: 2,
    finalPrice: 1_125,
    beforeCaptions: [
      "Standing water around the sump pit at arrival.",
      "Existing pump remains submerged but does not evacuate the pit.",
      "Wet floor extends from the failed sump area.",
    ],
    duringCaptions: [
      "Float and discharge tested before removing the failed pump.",
      "Replacement pump assembled with a new check valve and discharge fitting.",
    ],
    afterCaptions: [
      "Replacement pump cycling under a full-pit test.",
      "Sump pit covered after the installation.",
      "Basement floor dry after water removal and cleanup.",
    ],
    cycleOneNotes: [
      "Pump motor hums but does not move water. Float is free; impeller appears seized.",
      "Removed standing water and installed the replacement pump with a new check valve.",
      "Automatic cycle test passed. A return moisture check is scheduled before the job is closed.",
    ],
    visits: [
      {
        cycleNumber: 1,
        dayOffset: 0,
        status: "completed",
        notes: "Emergency visit removed water and replaced the failed pump assembly.",
      },
      {
        cycleNumber: 1,
        dayOffset: -1,
        status: "scheduled",
        notes: "Confirm the floor is dry and run a second automatic cycle test.",
      },
    ],
    revision: {
      cycleNumber: 1,
      dayOffset: 0,
      scopeText:
        "Replace the seized pump and failed check valve instead of attempting a temporary float adjustment.",
      priceChange: 475,
      reason: "Diagnosis found a seized impeller and a check valve that would not hold.",
      visitRequirement: "required",
      linkedVisitIndex: 1,
    },
    journeySummary:
      "The basement water was caused by a seized sump-pump impeller and a failed check valve. An emergency visit removed the water and installed the replacement assembly. The approved scope revision records the added replacement work. The job remains open until the scheduled dry-floor check and second automatic cycle test are complete.",
  },
  {
    slug: "deck-stair-repair",
    title: "Deck stair repair",
    description:
      "Replace the split stair tread and reinforce the loose rail-post connection without disturbing the surrounding composite decking.",
    clientNotes:
      "Back gate is unlocked. Keep the stairs blocked until every fastener is torqued and tested.",
    state: "completed",
    ageDays: 6,
    durationDays: 2,
    finalPrice: 875,
    beforeCaptions: [
      "Existing stair run documented before the damaged tread is removed.",
      "Split tread and loose rail-post connection shown at close range.",
    ],
    duringCaptions: [
      "Damaged tread removed without disturbing adjacent boards.",
      "Rail post leveled and drilled for the reinforcement bolts.",
      "Replacement tread predrilled to prevent splitting.",
    ],
    afterCaptions: [
      "Replacement tread aligned with the existing stair run.",
      "Post reinforcement tightened and documented.",
      "Stairs reopened after the final load and movement check.",
    ],
    cycleOneNotes: [
      "Lower tread is split at the fasteners and the right rail post moves under hand pressure.",
      "Installed a matched tread and reinforced the post with through-bolts, washers, and locking nuts.",
      "Load-tested the tread and pushed both rails in each direction; no remaining movement.",
    ],
    visits: [
      {
        cycleNumber: 1,
        dayOffset: 1,
        status: "completed",
        notes: "Replaced the tread, reinforced the rail post, and completed the safety check.",
      },
    ],
    journeySummary:
      "A split stair tread and moving rail post were documented before work. The damaged tread was removed, a matched replacement was predrilled and installed, and the post was reinforced with through-bolts. Final load and movement checks passed. The cycle is complete with a VOW.",
  },
  {
    slug: "exterior-trim-repair",
    title: "Exterior trim repair",
    description:
      "Remove rotted lower window trim, verify the substrate, install new exterior-grade stock, seal, prime, and paint.",
    clientNotes:
      "Avoid the planting bed below the window. Match the existing white as closely as practical.",
    state: "open",
    ageDays: 11,
    durationDays: 4,
    finalPrice: 1_260,
    beforeCaptions: [
      "Finished lower trim with sealed joints and matched paint.",
      "Full window after the trim repair and paint blend.",
    ],
    duringCaptions: [
      "Loose paint and softened wood removed to expose the extent of rot.",
      "Rotted lower trim removed and substrate checked for deeper damage.",
      "New exterior-grade trim fitted to the existing window profile.",
      "Perimeter joints sealed before primer and finish paint.",
    ],
    afterCaptions: [
      "Replacement trim sealed and painted at the lower joint.",
      "Finished window trim blended with the existing exterior.",
    ],
    cycleOneNotes: [
      "Rot is concentrated at the lower-right sill and casing joint. Substrate behind the removed trim is firm.",
      "Replacement stock is fitted and sealed. Primer needs a full cure before the finish coat.",
      "Finish paint is complete. Job remains open until the cured perimeter seal receives its final inspection.",
    ],
    visits: [
      {
        cycleNumber: 1,
        dayOffset: 1,
        status: "completed",
        notes: "Removed rot, verified the substrate, and installed and primed the replacement trim.",
      },
      {
        cycleNumber: 1,
        dayOffset: -2,
        status: "scheduled",
        notes: "Inspect the cured lower-window sealant joints and formally close the job.",
      },
    ],
    journeySummary:
      "The lower-right window trim was opened and the localized rot removed. New exterior-grade trim was fitted, sealed, primed, and painted. Finished work is documented; the job remains open for the cured perimeter-seal inspection and formal close-out.",
  },
  {
    slug: "bathroom-fan-replacement",
    title: "Bathroom fan replacement",
    description:
      "Replace the noisy, underperforming exhaust fan, secure the duct and wiring, and verify airflow at the grille.",
    clientNotes:
      "Use the upstairs hall bathroom. Client is sensitive to dust and wants the vanity covered.",
    state: "archived",
    ageDays: 20,
    durationDays: 1,
    finalPrice: 725,
    beforeCaptions: [
      "Original fan grille is yellowed and the unit runs loudly with weak draw.",
    ],
    duringCaptions: [
      "Old grille and fan assembly removed, exposing the existing flex duct.",
      "Replacement housing wired with the circuit de-energized.",
      "New housing fastened square to the ceiling framing.",
      "Final conductor splices secured inside the fan housing.",
    ],
    afterCaptions: [
      "Airflow verified at the new grille with the fan running.",
      "Replacement grille installed level and clean.",
      "Ceiling perimeter checked after final installation.",
    ],
    cycleOneNotes: [
      "Existing fan motor is noisy and airflow at the grille is weak. Duct is present and reusable.",
      "Installed the new housing, secured the flex duct, and completed enclosed conductor splices.",
      "Fan runs quietly and passes the tissue airflow check. Work area cleaned and released.",
    ],
    visits: [
      {
        cycleNumber: 1,
        dayOffset: 0,
        status: "completed",
        notes: "Removed the failed fan, installed the replacement, and verified airflow.",
      },
    ],
    journeySummary:
      "The noisy bathroom fan was removed, the existing duct inspected, and a new housing installed with secured ductwork and enclosed wiring. Airflow and sound were checked at the grille. The completed cycle has a full VOW and the old job is archived to keep active work uncluttered.",
  },
  {
    slug: "door-alignment",
    title: "Door alignment",
    description:
      "Correct the sticking entry door by tightening and adjusting the hinges and realigning the latch and strike.",
    clientNotes:
      "Do not change the exterior hardware finish without approval. Dog will be secured before arrival.",
    state: "cancelled",
    ageDays: 3,
    durationDays: 2,
    finalPrice: 340,
    cancellationReason:
      "Client approved the diagnostic adjustment but deferred the recommended jamb repair until the entry door is replaced.",
    beforeCaptions: [
      "Entry door documented out of alignment at the latch side.",
      "Latch rub and uneven reveal visible before adjustment.",
      "Lower hinge and loose fasteners documented before tightening.",
      "Strike mortise is worn from repeated misaligned contact.",
    ],
    duringCaptions: [
      "Hinge screws tightened and leaf position adjusted.",
      "Strike mortise carefully relieved for the corrected latch path.",
    ],
    afterCaptions: [
      "Corrected latch-to-strike alignment after adjustment.",
      "Door closes cleanly without binding at the jamb.",
    ],
    cycleOneNotes: [
      "Door has dropped at the latch side. Hinge screws are loose and the strike mortise has been enlarged by repeated contact.",
      "Tightened and adjusted the hinges and relieved the strike enough for safe operation. Jamb damage remains cosmetic and will need a larger repair if the door is retained.",
      "Client chose to stop after the functional adjustment and include the permanent jamb work with a future door replacement.",
    ],
    visits: [
      {
        cycleNumber: 1,
        dayOffset: 0,
        status: "completed",
        notes: "Completed diagnosis and a safe temporary hinge and strike adjustment.",
      },
    ],
    journeySummary:
      "The sticking entry door was traced to loose hinges and a worn strike mortise. A diagnostic visit restored safe operation with a hinge and strike adjustment, but permanent jamb repair was deferred. The client cancelled the remaining scope so it can be combined with a future door replacement.",
  },
  {
    slug: "ceiling-water-damage",
    title: "Ceiling water damage",
    description:
      "Measure the affected ceiling, open the damaged area, confirm the cavity is dry, then patch and prepare it for paint.",
    clientNotes:
      "Living room must be usable each evening. Cover the sofa and remove debris daily.",
    state: "open",
    ageDays: 7,
    durationDays: 4,
    finalPrice: 1_375,
    beforeCaptions: [
      "Wide view documents the ceiling stain above the living room.",
      "Moisture meter records the elevated center of the damaged area.",
    ],
    duringCaptions: [
      "Damaged boundary marked and living room protected before cutting.",
      "Ceiling opened to inspect joists and the cavity above.",
      "Drywall patch installed, taped, and coated.",
    ],
    afterCaptions: [
      "Ceiling receiving its final finish coat.",
      "Repaired area blended into the surrounding ceiling.",
      "Living room reset after the ceiling repair and cleanup.",
    ],
    cycleOneNotes: [
      "Stain is dry at the surface, but the center reads elevated on the moisture meter.",
      "Opened the ceiling within the marked boundary. Framing is sound; no active drip was observed during inspection.",
      "Patch and finish paint are complete. Keep the cycle open for the scheduled post-repair moisture reading and client walkthrough.",
    ],
    visits: [
      {
        cycleNumber: 1,
        dayOffset: 0,
        status: "completed",
        notes: "Measured moisture, opened the damaged area, and installed the first-stage patch.",
      },
      {
        cycleNumber: 1,
        dayOffset: -2,
        status: "scheduled",
        notes: "Take a post-repair moisture reading, inspect the blended finish, and complete client close-out.",
      },
    ],
    revision: {
      cycleNumber: 1,
      dayOffset: 1,
      scopeText:
        "Extend the ceiling opening to the adjacent joist bay, remove compromised material, and add a return visit for moisture verification before final paint.",
      priceChange: 385,
      reason: "Moisture readings extended beyond the stain visible from the room.",
      visitRequirement: "required",
      linkedVisitIndex: 1,
    },
    journeySummary:
      "Moisture readings extended beyond the visible ceiling stain, so the scope was revised to open the adjacent joist bay and add a verification visit. Framing was sound and the ceiling is now patched and painted. The job remains open for the post-repair moisture reading and client close-out.",
  },
  {
    slug: "kitchen-cabinet-repair",
    title: "Kitchen cabinet repair",
    description:
      "Repair the torn hinge mounting points, reinstall and align the door, and verify smooth closure across the cabinet run.",
    clientNotes:
      "Preserve the existing door and hardware if possible. Matching replacement doors are no longer available.",
    state: "completed",
    ageDays: 4,
    durationDays: 1,
    finalPrice: 465,
    beforeCaptions: [
      "Broken upper hinge and torn mounting points documented at close range.",
      "Misaligned cabinet door documented before the hinge repair.",
      "Wide view records uneven gaps across the cabinet run.",
    ],
    duringCaptions: [
      "Damaged hinge removed from the torn mounting area.",
      "Mounting void rebuilt with repair compound before redrilling.",
      "Pilot holes drilled for the reinstalled hinge screws.",
    ],
    afterCaptions: [
      "Reinstalled hinge holds firmly at the repaired mounting points.",
      "Door closes smoothly and aligns with the neighboring fronts.",
    ],
    cycleOneNotes: [
      "Upper hinge screws pulled through the cabinet-side mounting material; door and hinge are reusable.",
      "Rebuilt the mounting points, allowed the repair to set, then drilled new pilots and reinstalled the hinge.",
      "Adjusted both hinges for even gaps and tested repeated opening and soft closure.",
    ],
    visits: [
      {
        cycleNumber: 1,
        dayOffset: 0,
        status: "completed",
        notes: "Rebuilt the hinge mounting points and aligned the retained cabinet door.",
      },
    ],
    journeySummary:
      "The cabinet door was saved by rebuilding the torn hinge mounting points rather than replacing the unavailable door. After curing, the hinge was reinstalled in new pilot holes and both hinges were adjusted for even gaps and smooth closure. The cycle is complete with a VOW.",
  },
] as const;

export type SamplePipelineProject = {
  title: string;
  description: string;
  clientNotes: string;
  ageDays: number;
  state: "open" | "cancelled";
  scheduledVisit: string | null;
  cancellationReason?: string;
  journeySummary: string;
};

export const samplePipelineProjects: readonly SamplePipelineProject[] = [
  {
    title: "Gutter downspout extension",
    description:
      "Redirect the rear downspout away from the foundation and confirm positive drainage across the side yard.",
    clientNotes:
      "Rear gate access is available. Avoid routing discharge across the walkway.",
    ageDays: 16,
    state: "open",
    scheduledVisit:
      "Measure the rear run, confirm the discharge location, and install the extension.",
    journeySummary:
      "The approved downspout-extension job is open and awaiting its first scheduled site visit. No field work, notes, or photos have been recorded yet.",
  },
  {
    title: "Vanity faucet leak",
    description:
      "Diagnose the leak beneath the hall-bath vanity and repair the supply, drain, or faucet connection responsible.",
    clientNotes:
      "Client has shut off the vanity stops. Text when arriving because the baby may be sleeping.",
    ageDays: 14,
    state: "open",
    scheduledVisit:
      "Diagnose the active vanity leak and bring common supply and drain repair parts.",
    journeySummary:
      "The hall-bath vanity leak was approved as a job and is scheduled for diagnosis. The source has not yet been confirmed, so no repair scope or media has been invented.",
  },
  {
    title: "Porch light replacement",
    description:
      "Replace the failed front-porch fixture and verify the switch, box, grounding, and weather seal.",
    clientNotes:
      "Replacement fixture is on site in the foyer. Preserve the existing wall finish.",
    ageDays: 12,
    state: "open",
    scheduledVisit:
      "Install the owner-supplied porch fixture and test the exterior circuit.",
    journeySummary:
      "The porch-light replacement is approved and scheduled. The fixture is owner supplied; installation and electrical verification have not started.",
  },
  {
    title: "Basement door weatherstrip",
    description:
      "Replace the failed perimeter weatherstrip and adjust the sweep to stop the visible draft at the basement entry.",
    clientNotes:
      "Use the side entrance. Client wants the existing threshold retained if it can seal correctly.",
    ageDays: 10,
    state: "open",
    scheduledVisit:
      "Measure the jamb and sweep, then replace the failed weather seals.",
    journeySummary:
      "The basement-entry weatherstrip job is open with a first visit scheduled. Existing conditions will be documented when field work begins.",
  },
  {
    title: "Garage drywall patch",
    description:
      "Patch the access opening beside the garage panel while preserving required electrical clearances.",
    clientNotes:
      "Keep the electrical panel fully accessible. Matching paint is not currently available.",
    ageDays: 9,
    state: "open",
    scheduledVisit: null,
    journeySummary:
      "The garage drywall patch was approved but has not been scheduled. No visit, field note, or photo exists because work has not begun.",
  },
  {
    title: "Loose toilet repair",
    description:
      "Reset the rocking first-floor toilet, inspect the flange, and confirm a watertight seal.",
    clientNotes:
      "First-floor powder room. Client can provide access most weekday mornings.",
    ageDays: 7,
    state: "open",
    scheduledVisit:
      "Pull and reset the toilet, inspect the flange, and test for leaks.",
    journeySummary:
      "The loose-toilet repair is approved and scheduled. The flange condition remains unknown until the fixture is lifted on site.",
  },
  {
    title: "Storm door closer",
    description:
      "Replace the bent storm-door closer and adjust closing speed and latch engagement.",
    clientNotes:
      "Front storm door swings toward the walkway. Match the existing dark hardware if available.",
    ageDays: 6,
    state: "open",
    scheduledVisit: null,
    journeySummary:
      "The storm-door closer replacement is approved and waiting to be scheduled. No field documentation exists yet.",
  },
  {
    title: "Exterior hose bib leak",
    description:
      "Diagnose the leaking rear hose bib and replace the valve or packing without damaging the siding penetration.",
    clientNotes:
      "Basement shutoff is labeled. Rear hose has already been disconnected.",
    ageDays: 4,
    state: "open",
    scheduledVisit:
      "Inspect the hose bib from inside and outside, isolate the line, and repair the leak.",
    journeySummary:
      "The exterior hose-bib leak is approved and scheduled for diagnosis. The exact repair remains intentionally undecided until access is inspected.",
  },
  {
    title: "Bedroom ceiling fan",
    description:
      "Install an owner-supplied ceiling fan after verifying that the existing box is fan-rated.",
    clientNotes:
      "Client selected another contractor who could complete the work with the painting project.",
    ageDays: 28,
    state: "cancelled",
    scheduledVisit: null,
    cancellationReason:
      "Client bundled the installation with a larger bedroom painting project before field work began.",
    journeySummary:
      "The ceiling-fan job was approved but cancelled before scheduling or field work because the client bundled it with another project. No photos or notes were fabricated.",
  },
  {
    title: "Mailbox post replacement",
    description:
      "Remove the leaning mailbox post and install a replacement at the required setback and height.",
    clientNotes:
      "Client decided to wait until the driveway contractor finishes grading the shoulder.",
    ageDays: 25,
    state: "cancelled",
    scheduledVisit: null,
    cancellationReason:
      "Work was deferred until planned driveway grading establishes the final roadside elevation.",
    journeySummary:
      "The mailbox-post job was cancelled before field work because upcoming driveway grading will change the final elevation. There are correctly no visits, notes, or media.",
  },
  {
    title: "Laundry shutoff valves",
    description:
      "Replace the aging washer shutoff valves and verify both supplies under operating pressure.",
    clientNotes:
      "Client postponed the repair after the appliance delivery date changed.",
    ageDays: 22,
    state: "cancelled",
    scheduledVisit: null,
    cancellationReason:
      "Client postponed the valve replacement until the rescheduled washer delivery is confirmed.",
    journeySummary:
      "The laundry shutoff-valve job was cancelled before scheduling when the appliance delivery moved. No field activity is represented.",
  },
] as const;

export const sampleIntakeRequests = [
  "Fence gate dragging",
  "Dining room dimmer buzzing",
  "Attic hatch weather seal",
  "Kitchen sink slow drain",
  "Loose stair handrail",
  "Garage side-door lock",
  "Closet shelf collapse",
  "Exterior caulk inspection",
  "Powder-room mirror mounting",
] as const;

export function samplePhotoFiles(
  project: SampleProject,
  includeAfter: boolean,
): Array<{
  filename: string;
  stage: "before" | "during" | "after";
  caption: string;
}> {
  const groups = [
    ["B", "before", project.beforeCaptions],
    ["D", "during", project.duringCaptions],
    ["A", "after", includeAfter ? project.afterCaptions : []],
  ] as const;

  return groups.flatMap(([prefix, stage, captions]) =>
    captions.map((caption, index) => ({
      filename: `${prefix}-${index + 1}.png`,
      stage,
      caption,
    })),
  );
}
