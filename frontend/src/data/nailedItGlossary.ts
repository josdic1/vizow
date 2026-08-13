export type NailedItGlossaryTerm = {
  term: string;
  category:
    | "Framing"
    | "Concrete"
    | "Roofing"
    | "Electrical"
    | "Plumbing"
    | "General";
  definition: string;
};

export const nailedItGlossaryTerms: NailedItGlossaryTerm[] = [
  { term: "OC (On Center)", category: "Framing", definition: 'Distance measured from the center of one framing member to the center of the next, typically 16" or 24".' },
  { term: "Stud", category: "Framing", definition: "A vertical framing member in a wall, typically 2x4 or 2x6." },
  { term: "King Stud", category: "Framing", definition: "A full-height stud on either side of a rough opening, running from sole plate to top plate." },
  { term: "Jack Stud (Trimmer)", category: "Framing", definition: "A shorter stud nailed to the inside of a king stud that supports the header." },
  { term: "Header", category: "Framing", definition: "A horizontal beam above a door or window opening that carries the load around it." },
  { term: "Cripple Stud", category: "Framing", definition: "A short stud above a header or below a sill that fills the gap to the plate." },
  { term: "Top Plate", category: "Framing", definition: "The horizontal member at the top of a wall that studs are nailed into, often doubled." },
  { term: "Sole Plate", category: "Framing", definition: "The horizontal framing member at the bottom of a wall, also called the bottom plate." },
  { term: "Rafter", category: "Framing", definition: "A sloped structural member running from the ridge to the wall plate, supporting the roof deck." },
  { term: "Ridge Board", category: "Framing", definition: "The horizontal member at the peak of a roof that rafters attach to." },
  { term: "Joist", category: "Framing", definition: "A horizontal framing member that supports a floor or ceiling." },
  { term: "Sistering", category: "Framing", definition: "Attaching a new piece of lumber alongside an existing joist or rafter to reinforce it." },
  { term: "Crown", category: "Framing", definition: "The slight upward bow along a board's edge; framed crown-up." },
  { term: "Let-in Brace", category: "Framing", definition: "A diagonal brace notched into studs to resist wall racking." },
  { term: "Toe-nail", category: "Framing", definition: "Driving a nail at an angle through the end of one member into another." },

  { term: "Footing", category: "Concrete", definition: "The widened base of a foundation that spreads the structure's load into the soil." },
  { term: "Rebar", category: "Concrete", definition: "Steel reinforcing bar embedded in concrete to add tensile strength." },
  { term: "Slump", category: "Concrete", definition: "A measure of concrete's wetness and workability before it sets." },
  { term: "Cure Time", category: "Concrete", definition: "The time concrete needs to reach design strength, commonly 28 days for full strength." },
  { term: "Vapor Barrier", category: "Concrete", definition: "A layer, often plastic sheeting, placed under a slab to block ground moisture." },
  { term: "Formwork", category: "Concrete", definition: "Temporary molds that hold concrete in place while it cures." },

  { term: "Pitch", category: "Roofing", definition: "The steepness of a roof, expressed as inches of rise per 12 inches of run." },
  { term: "Square (roofing)", category: "Roofing", definition: "A roofing measurement equal to 100 square feet of roof area." },
  { term: "Underlayment", category: "Roofing", definition: "A water-resistant layer installed under shingles for extra protection." },
  { term: "Flashing", category: "Roofing", definition: "Thin metal installed at roof joints and penetrations to direct water away." },
  { term: "Fascia", category: "Roofing", definition: "The vertical board that caps the ends of rafters at the roofline." },
  { term: "Soffit", category: "Roofing", definition: "The finished underside of a roof overhang." },
  { term: "Ridge Vent", category: "Roofing", definition: "A ventilation strip along the roof peak that lets hot attic air escape." },

  { term: "Romex", category: "Electrical", definition: "A common brand name used generically for non-metallic (NM) sheathed electrical cable." },
  { term: "Home Run", category: "Electrical", definition: "The wire run from the breaker panel to the first device on a circuit." },
  { term: "GFCI", category: "Electrical", definition: "Ground Fault Circuit Interrupter, an outlet or breaker that cuts power to prevent shock near water." },
  { term: "Amperage", category: "Electrical", definition: "The measure of electrical current a circuit or wire can safely carry." },

  { term: "PEX", category: "Plumbing", definition: "Cross-linked polyethylene tubing used for water supply lines." },
  { term: "Trap", category: "Plumbing", definition: "A curved section of drain pipe that holds water to block sewer gas." },
  { term: "Vent Stack", category: "Plumbing", definition: "A pipe that lets air into the drain system so water flows properly." },
  { term: "Drain Slope", category: "Plumbing", definition: 'The fall of a drain pipe, typically 1/4" per foot, so waste flows by gravity.' },

  { term: "OSB", category: "General", definition: "Oriented Strand Board, an engineered wood sheathing panel made of compressed wood strands." },
  { term: "CDX", category: "General", definition: "A grade of plywood commonly used for sheathing." },
  { term: "LVL", category: "General", definition: "Laminated Veneer Lumber, an engineered beam made of layered wood veneers." },
  { term: "PT Lumber", category: "General", definition: "Pressure-treated lumber, chemically treated to resist rot and insects." },
  { term: "R-Value", category: "General", definition: "A measure of insulation's resistance to heat flow; higher means better insulation." },
  { term: "Shim", category: "General", definition: "A thin piece of material used to fill a gap or bring a surface to level or plumb." },
  { term: "Plumb", category: "General", definition: "Perfectly vertical." },
  { term: "Level", category: "General", definition: "Perfectly horizontal." },
  { term: "Square", category: "General", definition: "At a perfect 90-degree angle." },
  { term: "Kerf", category: "General", definition: "The width of material removed by a saw blade during a cut." },
  { term: "Dado", category: "General", definition: "A rectangular groove cut across the grain of a board." },
  { term: "Rabbet", category: "General", definition: "An L-shaped groove cut along the edge of a board." },
];
