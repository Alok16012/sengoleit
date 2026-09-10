// The Entry Type options a student can be admitted under.
//
// Kept here rather than inside either screen: the Centers list decides which
// of them a centre may use (centers.entry_types) and Student Entry renders the
// dropdown from the same list, so a value added in one place has to appear in
// the other. An empty / unset centers.entry_types means no restriction.
export const ENTRY_TYPES = ['Regular', 'Lateral', 'External']
