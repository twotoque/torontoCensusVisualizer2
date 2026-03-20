# figures.py
# computation (old censusMap / censusBar / censusBarStack)
# Takes dataframes in, returns Plotly figure dicts out.
import json
import statistics
import textwrap

import geopandas as gpd
import pandas as pd
import plotly.graph_objects as go

def build_map(
    geo_gdf, geo_dict, wards_gdf, census_df,
    row_index, label_col="Neighbourhood Name", wards_name_col="AREA_NAME"
) -> dict:
    """
    Map for a single census row across all Toronto neighbourhoods.
    Equivalent to the original censusMap() function.

    Returns a Plotly figure as a JSON-serialisable dict.
    Go caches this dict and forwards it to React.
    React renders it with Plotly.js
    """
    columns_set = set(census_df.columns)
    graph_title = str(census_df.iloc[row_index][label_col])

    z_values: list = []
    for _, geo_row in geo_gdf.drop(columns="geometry").iterrows():
        name = geo_row["AREA_NAME"]
        if name in columns_set:
            z_values.append(census_df[name].iloc[row_index])
        else:
            z_values.append(None)

    fig = go.Figure(go.Choroplethmapbox(
        geojson=geo_dict,
        locations=geo_gdf["AREA_ID"],
        featureidkey="properties.AREA_ID",
        z=z_values,
        marker_opacity=0.5,
        marker_line_width=1,
        text=geo_gdf["AREA_NAME"],
        hoverinfo="text+z",
        hovertemplate="%{text}<br>%{z}<extra></extra>",
        hoverlabel=dict(font=dict(family="proxima-nova, sans-serif")),
        colorbar=dict(
            title="Value",
            tickfont=dict(family="proxima-nova, sans-serif"),
        ),
    ))

    wards_dict = json.loads(wards_gdf.to_json())
    for feature in wards_dict["features"]:
        ward_name = feature["properties"][wards_name_col] 
        for polygon in feature["geometry"]["coordinates"]:
            for ring in polygon:
                fig.add_trace(go.Scattermapbox(
                    mode="lines",
                    showlegend=True,
                    lon=[c[0] for c in ring],
                    lat=[c[1] for c in ring],
                    line=dict(width=2, color="red"),
                    name=ward_name,
                    text=ward_name,
                    hoverlabel=dict(font=dict(family="proxima-nova, sans-serif")),
                ))

    fig.update_layout(
        mapbox_style="carto-positron",
        mapbox_zoom=10,
        mapbox_center={"lat": 43.710, "lon": -79.380},
        margin={"r": 0, "t": 60, "l": 0, "b": 0},
        title={
            "text": graph_title,
            "x": 0.5,
            "xanchor": "center",
            "yanchor": "top",
            "font": {"family": "proxima-nova, sans-serif", "weight": 700, "size": 25},
        },
        legend=dict(
            x=1.1, y=0.25,
            xanchor="left", yanchor="middle",
            font={"family": "proxima-nova, sans-serif"},
        ),
        annotations=[dict(
            xref="paper", yref="paper",
            x=1.1, y=0.95,
            text="Made with<br>torontocensusvisualizer.com",
            xanchor="left", yanchor="middle",
            showarrow=False, align="left",
            font={"family": "proxima-nova, sans-serif"},
        )],
    )

    return fig.to_dict()



def build_bar(
    census_df: pd.DataFrame,
    row_index: int,
    label_col: str = "Neighbourhood Name",
) -> dict:
    """
    Bar chart for a single census row across all neighbourhoods, with a city-wide median line.
    Equivalent to the original censusBar() function.

    Returns a Plotly figure as a JSON parsasable dict.
    """
    col_start   = census_df.columns.get_loc(label_col)
    row         = census_df.iloc[row_index]
    graph_title = str(row[label_col])
    raw_values  = row.iloc[col_start + 1:].to_list()
    x_values    = census_df.columns.to_list()[col_start + 1:]

    try:
        y_values = list(map(float, raw_values))
    except ValueError:
        y_values = raw_values

    fig = go.Figure()
    fig.add_trace(go.Bar(
        x=x_values,
        y=y_values,
        name="Neighbourhood<br>Data",
        marker_color="blue",
    ))

    # Median line
    if y_values and isinstance(y_values[0], float):
        median = statistics.median(y_values)
        x1_endpoint = len(x_values)

        fig.add_shape(
            type="line",
            x0=-0.5,
            x1=x1_endpoint - 0.35,
            y0=median,
            y1=median,
            line=dict(color="red", width=3, dash="dash"),
        )
        fig.add_trace(go.Scatter(
            x=[None], y=[None],
            mode="lines",
            line=dict(color="red", width=2, dash="dash"),
            showlegend=True,
            name=f"City-wide Median<br>({median:,.1f})",
        ))

    fig.update_layout(
        title={
            "text": graph_title,
            "x": 0.5, "xanchor": "center", "yanchor": "top",
            "font": {"family": "proxima-nova, sans-serif", "weight": 700, "size": 25},
        },
        xaxis_title="Neighbourhood<br>Made with torontocensusvisualizer.com",
        yaxis_title="Value",
        hoverlabel=dict(font=dict(family="proxima-nova, sans-serif")),
        title_font=dict(family="proxima-nova, sans-serif"),
        xaxis_title_font=dict(family="proxima-nova, sans-serif"),
        yaxis_title_font=dict(family="proxima-nova, sans-serif"),
        font=dict(family="proxima-nova, sans-serif"),
    )

    return fig.to_dict()


# Stacked bar

def build_stack(
    census_df: pd.DataFrame,
    row_indices: list[int],  # 0-based DataFrame indices
    label_col: str = "Neighbourhood Name",
) -> dict:
    """
    Stacked bar chart combining multiple census rows.
    Equivalent to the original censusBarStack() function.

    Returns a Plotly figure as a JSON parsable dict.
    """
    col_start = census_df.columns.get_loc(label_col)
    x_values  = census_df.columns.to_list()[col_start + 1:]
    fig       = go.Figure()

    for idx in row_indices:
        row   = census_df.iloc[idx]
        title = str(row[label_col])
        y     = list(map(float, row.iloc[col_start + 1:].values))

        fig.add_trace(go.Bar(
            x=x_values,
            y=y,
            name="<br>".join(textwrap.wrap(title, width=18)),
        ))

    fig.update_layout(
        barmode="stack",
        title={
            "text": "Multi-variable stacked bar graph using Census 2021 data, City of Toronto",
            "x": 0.5, "xanchor": "center", "yanchor": "top",
            "font": {"family": "proxima-nova, sans-serif", "weight": 700, "size": 25},
        },
        xaxis_title="Neighbourhood<br>Made with torontocensusvisualizer.com",
        yaxis_title="Value",
        hoverlabel=dict(font=dict(family="proxima-nova, sans-serif")),
        xaxis_title_font=dict(family="proxima-nova, sans-serif"),
        yaxis_title_font=dict(family="proxima-nova, sans-serif"),
        font=dict(family="proxima-nova, sans-serif"),
    )

    return fig.to_dict()


# search

def search_rows(
    census_df: pd.DataFrame,
    query: str,
    limit: int = 5,
    label_col: str = "Neighbourhood Name",
    id_col: str | None = None,
    mode: str = "auto",
) -> list[dict]:
    """
    Substring search across label column.
    Equivalent to the original suggestion logic in update_output / update_array.

    Returns list of {row, label}, row == 1-based display row number
    Go expects (matching the original row numbering convention).
    """

    query = query.strip()

    if id_col and id_col in census_df.columns and query.isdigit():
        mask = census_df[id_col].astype(str) == query
    else:
        mask = census_df[label_col].str.contains(query, case=False, regex=False, na=False)

    matched = census_df[mask].head(limit)

    use_id = id_col and id_col in census_df.columns
    return [
        {
            "row":   int(row[id_col]) if use_id else int(idx) + 2,
            "label": str(row[label_col]),
        }
        for idx, row in matched.iterrows()
    ]

def export_pdf(fig_dict: dict, kind: str) -> bytes:
    """
    Render a Plotly figure dict to PDF bytes using Kaleido.
    Equivalent to the original fig.write_image() calls.

    kind — "map" or "bar" or "stack", controls export dimensions.
    """
    import io
    import plotly.io as pio
    pio.kaleido.scope.mathjax = None

    width, height = {
        "map":   (1300, 900),
        "bar":   (3000, None),
        "stack": (3000, None),
    }.get(kind, (1300, 900))

    fig = go.Figure(fig_dict)

    kwargs = {"format": "pdf", "engine": "kaleido", "width": width}
    if height:
        kwargs["height"] = height

    return fig.to_image(**kwargs)