return $('Filter new').first().json.candidates.map((c) => ({ json: { link: c.link } }));
